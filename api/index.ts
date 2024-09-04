import { App } from "@slack/bolt";
import axios from "axios";
import dotenv from "dotenv";
import { VercelRequest, VercelResponse } from "@vercel/node";

dotenv.config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
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
    // console.log("Response:", response.data);
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
  await ack();
  const username = command.text.trim();

  // Send initial loading message
  const loadingMessage = await respond({
    text: `:hourglass: Fetching permissions for *${username}*...`,
    response_type: "ephemeral",
  });

  try {
    const groups = await getUserGroups(username);

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
    } else {
      // If ts is not available, send a new message
      await respond({
        text: resultMessage,
        response_type: "ephemeral",
      });
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
    } else {
      await respond({
        text: errorMessage,
        response_type: "ephemeral",
      });
    }
  }
});

// Export the serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  console.log("Received request:", req.method, req.url);
  if (req.method === "GET") {
    res.status(200).send("Server is running");
    return;
  }

  res.status(405).send("Method Not Allowed");
};

// Start the app (this is necessary for socket mode)
(async () => {
  await app.start();
  console.log("⚡️ Bolt app is running!");
})();
