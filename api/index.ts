import { App, ExpressReceiver } from "@slack/bolt";
import axios from "axios";
import dotenv from "dotenv";
import { VercelRequest, VercelResponse } from "@vercel/node";
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

dotenv.config();

// Prisma setup
const prisma = new PrismaClient();

// Existing code for Slack app setup
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  processBeforeResponse: true,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  receiver,
});

interface AuthResponse {
  data: {
    token: string;
    expires_in: number;
  };
}

interface User {
  uuid: string;
  username: string;
  email: string;
  enabled: boolean;
  status: string;
  site_ids: number[];
  created_at: string;
  updated_at: string;
  groups: string[];
}

interface UsersResponse {
  data: {
    [key: string]: User;
  };
}

let authToken: string | null = null;
let tokenExpiration: number | null = null;

async function getAuthToken(): Promise<string> {
  if (authToken && tokenExpiration && tokenExpiration > Date.now()) {
    return authToken;
  }

  try {
    const response = await axios.post<AuthResponse>(
      `${process.env.API_BASE_URL}/auth/get-token/`,
      {
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    if (!response.data.data.token) {
      throw new Error("Token not received in the response");
    }

    authToken = response.data.data.token;
    tokenExpiration = Date.now() + response.data.data.expires_in * 1000;
    return authToken;
  } catch (error) {
    console.error("Error getting auth token:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response data:", error.response?.data);
      console.error("Response status:", error.response?.status);
    }
    throw new Error(
      `Failed to get auth token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

async function getUserGroups(username: string): Promise<string[] | null> {
  try {
    const token = await getAuthToken();
    console.log("Token:", token);
    const response = await axios.get<UsersResponse>(
      `${process.env.API_BASE_URL}/admin/users`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    const user = response.data.data[username];
    console.log("User:", user);
    if (user) {
      return user.groups;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    throw error;
  }
}

async function updateUserGroupsInDB(username: string, groups: string[]) {
  await prisma.user.upsert({
    where: { username: username },
    update: {
      groups: groups,
      updatedAt: new Date(),
    },
    create: {
      username: username,
      groups: groups,
    },
  });
}

async function getUserGroupsFromDB(username: string): Promise<string[] | null> {
  const user = await prisma.user.findUnique({
    where: { username: username },
  });
  return user?.groups || null;
}

// Cron job to update all user groups daily
cron.schedule("0 0 * * *", async () => {
  console.log("Running daily user group update");
  try {
    const token = await getAuthToken();
    const response = await axios.get<UsersResponse>(
      `${process.env.API_BASE_URL}/admin/users`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    for (const [username, user] of Object.entries(response.data.data)) {
      await updateUserGroupsInDB(username, user.groups);
    }
    console.log("Daily user group update completed");
  } catch (error) {
    console.error("Error updating user groups:", error);
  }
});

// Modified Slack command to use the database
app.command("/permissions", async ({ command, ack, respond, client }) => {
  await ack();
  console.log("Acknowledged command");

  await respond({
    response_type: "ephemeral",
    text: ":hourglass: Fetching permissions... This may take a moment.",
  });

  try {
    const username = command.text.trim();
    console.log(`Processing command for username: ${username}`);

    let groups = await getUserGroupsFromDB(username);

    if (!groups) {
      // If not in DB, fetch from API and update DB
      groups = await getUserGroups(username);
      if (groups) {
        await updateUserGroupsInDB(username, groups);
      }
    }

    let resultMessage;
    if (groups && groups.length > 0) {
      resultMessage = `User *${username}* belongs to the following groups:\n\`\`\`\n${groups.join(
        "\n"
      )}\n\`\`\``;
    } else if (groups && groups.length === 0) {
      resultMessage = `User *${username}* doesn't belong to any groups.`;
    } else {
      resultMessage = `User *${username}* not found.`;
    }

    await client.chat.postMessage({
      channel: command.channel_id,
      text: resultMessage,
      thread_ts: command.ts,
      response_type: "ephemeral",
    });
    console.log("Sent result message");
  } catch (error) {
    console.error("Error in /permissions command:", error);
    const errorMessage = "An error occurred while fetching user data.";

    await client.chat.postMessage({
      channel: command.channel_id,
      text: errorMessage,
      thread_ts: command.ts,
      response_type: "ephemeral",
    });
    console.log("Sent error message");
  }
});

// Export the serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  console.log("Received request:", req.method, req.url);
  if (req.method === "GET") {
    res.status(200).send("Server is running");
    return;
  }

  if (req.body && req.body.type === "url_verification") {
    res.status(200).json({ challenge: req.body.challenge });
    return;
  }

  try {
    console.log("Handling request with receiver...");
    await receiver.requestHandler(req as any, res as any);
    console.log("Request handled successfully");
  } finally {
    await prisma.$disconnect();
  }
};
