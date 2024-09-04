import { App, ExpressReceiver } from "@slack/bolt";
import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import dotenv from "dotenv";
import { Request } from "express";
import { Response } from "express";

dotenv.config();

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
  processBeforeResponse: true,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

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
  await ack();
  const username = command.text.trim();

  // Respond immediately
  await respond({
    text: `:hourglass: We've received your request for *${username}*'s permissions. We'll post the results shortly.`,
    response_type: "ephemeral",
  });

  // Process the request asynchronously
  processPermissionsRequest(username, respond);
});

async function processPermissionsRequest(username: string, respond: Function) {
  try {
    const groups = await getUserGroups(username);
    console.log(`Groups for ${username}:`, groups);

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

    // Send the result as a new message
    await respond({
      text: resultMessage,
      response_type: "ephemeral",
    });
  } catch (error) {
    console.error("Error in permissions command:", error);

    // Send the error as a new message
    await respond({
      text: "An error occurred while fetching user data.",
      response_type: "ephemeral",
    });
  }
}

function adaptRequest(req: VercelRequest): Request {
  return req as unknown as Request;
}

function adaptResponse(res: VercelResponse): Response {
  return res as unknown as Response;
}

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // await app.start();
    await receiver.requestHandler(adaptRequest(req), adaptResponse(res));
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).send("Internal Server Error");
  }
};
