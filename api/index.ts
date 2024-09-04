import { App, ExpressReceiver } from "@slack/bolt";
import axios from "axios";
import dotenv from "dotenv";
import { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

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

app.command("/permissions", async ({ command, ack, respond, client }) => {
  // Acknowledge the command immediately
  await ack();
  console.log("Acknowledged command");

  // Perform the longer processing asynchronously
  (async () => {
    const username = command.text.trim();
    console.log(`Processing command for username: ${username}`);

    // Send initial loading message
    let loadingMessage;
    try {
      loadingMessage = await respond({
        text: `:hourglass: Fetching permissions for *${username}*...`,
        response_type: "ephemeral",
      });
      console.log("Sent initial loading message");
    } catch (error) {
      console.error("Error sending initial loading message:", error);
      return;
    }

    try {
      const groups = await getUserGroups(username);
      console.log("Fetched user groups:", groups);

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

      // Check if loadingMessage.ts exists before updating
      if (loadingMessage.ts) {
        await client.chat.update({
          channel: command.channel_id,
          ts: loadingMessage.ts,
          text: resultMessage,
        });
        console.log("Updated loading message with result");
      } else {
        // If ts is not available, send a new message
        await respond({
          text: resultMessage,
          response_type: "ephemeral",
        });
        console.log("Sent result message");
      }
    } catch (error) {
      console.error("Error in /permissions command:", error);

      // Send error message, either by updating or sending a new message
      const errorMessage = "An error occurred while fetching user data.";
      if (loadingMessage.ts) {
        await client.chat.update({
          channel: command.channel_id,
          ts: loadingMessage.ts,
          text: errorMessage,
        });
        console.log("Updated loading message with error");
      } else {
        await respond({
          text: errorMessage,
          response_type: "ephemeral",
        });
        console.log("Sent error message");
      }
    }
  })();
});

// Export the serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  console.log("Received request:", req.method, req.url);
  if (req.method === "GET") {
    res.status(200).send("Server is running");
    return;
  }

  // Handle Slack URL verification challenge
  if (req.body && req.body.type === "url_verification") {
    res.status(200).json({ challenge: req.body.challenge });
    return;
  }

  try {
    console.log("Handling request with receiver...");
    await receiver.requestHandler(req as any, res as any);
    console.log("Request handled successfully");
  } catch (error) {
    console.error("Error handling request:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    res.status(500).json({
      error: "Internal Server Error",
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
};
