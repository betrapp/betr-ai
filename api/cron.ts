// api/cron.ts
import { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import { getAllUserGroups } from "../src/services/userService";

const prisma = new PrismaClient();

async function updateAllUserGroups() {
  try {
    const userGroups = await getAllUserGroups();
    for (const { user, groups } of userGroups) {
      await prisma.user.update({
        where: { username: user },
        data: {
          groups: {
            set: groups,
          },
        },
      });
    }
    console.log("All user groups updated");
  } catch (error) {
    console.error("Error updating user groups:", error);
  } finally {
    await prisma.$disconnect();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    console.log("Cron job started");
    await updateAllUserGroups();
    console.log("Cron job completed");
    res.status(200).json({ message: "Cron job completed successfully" });
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
