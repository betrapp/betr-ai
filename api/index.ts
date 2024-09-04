import { App, ExpressReceiver } from "@slack/bolt";
import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import axios from "axios"; // Add this import
import { Request, Response } from "express";

dotenv.config();

console.log("Environment variables loaded");

if (!process.env.SLACK_BOT_TOKEN) {
  throw new Error("SLACK_BOT_TOKEN is not set");
}

if (!process.env.SLACK_SIGNING_SECRET) {
  throw new Error("SLACK_SIGNING_SECRET is not set");
}

console.log("SLACK_BOT_TOKEN is set:", !!process.env.SLACK_BOT_TOKEN);
console.log(
  "SLACK_BOT_TOKEN prefix:",
  process.env.SLACK_BOT_TOKEN?.substring(0, 5)
);

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

console.log("Slack App created");

// Error handler
app.error(async (error) => {
  console.error("An error occurred:", error);
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
    console.log("Debug: Using cached token");
    return authToken;
  }

  try {
    console.log("Debug: Requesting new auth token");
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

    console.log("Debug: Auth response status:", response.status);
    console.log(
      "Debug: Auth response data:",
      JSON.stringify(response.data, null, 2)
    );

    authToken = response.data.data.token;
    tokenExpiration = Date.now() + response.data.data.expires_in * 1000;
    return authToken;
  } catch (error) {
    console.error("Error getting auth token:", error);
    if (axios.isAxiosError(error)) {
      console.error(
        "Debug: Auth error response:",
        JSON.stringify(error.response?.data, null, 2)
      );
    }
    throw error;
  }
}

async function getUserGroups(username: string): Promise<string[] | null> {
  try {
    const token = await getAuthToken();
    console.log(`Debug: Token received:`, token);

    if (!token) {
      console.error("Debug: No auth token received");
      return null;
    }

    const url = `${process.env.API_BASE_URL}/admin/users`;
    console.log(`Debug: Requesting URL: ${url}`);

    const response = await axios.get<UsersResponse>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log(`Debug: Response status: ${response.status}`);
    console.log(
      `Debug: Response data: ${JSON.stringify(response.data, null, 2)}`
    );

    const userData = response.data.data;
    const user = userData[username];
    if (user) {
      return user.groups;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    if (axios.isAxiosError(error)) {
      console.error(
        `Debug: Error response: ${JSON.stringify(
          error.response?.data,
          null,
          2
        )}`
      );
    }
    return null;
  }
}

app.command("/permissions", async ({ command, ack, respond }) => {
  console.log("Received /permissions command");
  await ack();
  try {
    // Your command logic here
    await respond("Command processed successfully");
  } catch (error) {
    console.error("Error processing command:", error);
    await respond("An error occurred while processing the command");
  }
});

// Export the serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  console.log("Received request:", req.method, req.url);
  try {
    console.log("Handling request with receiver...");
    await receiver.requestHandler(
      req as unknown as Request,
      adaptVercelResponse(res)
    );
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

function adaptVercelResponse(res: VercelResponse): Response {
  return res as unknown as Response;
}
