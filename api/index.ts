import { App, ExpressReceiver } from "@slack/bolt";
import dotenv from "dotenv";
import { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import { setupSlackApp } from "../src/config/slackConfig";
import { handlePermissionsCommand } from "../src/handlers/permissionsHandler";

dotenv.config();

const prisma = new PrismaClient();
const { app, receiver } = setupSlackApp();

app.command("/permissions", handlePermissionsCommand);

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
