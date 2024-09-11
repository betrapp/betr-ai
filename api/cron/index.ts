import { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import { getAllUserGroups } from "../../src/services/userService";

export const config = {
  maxDuration: 30,
};

const prisma = new PrismaClient();

async function updateAllUserGroups() {
  try {
    const userGroups = await getAllUserGroups();
    for (const { user, groups } of userGroups) {
      try {
        await prisma.user.update({
          where: { username: user },
          data: {
            groups: {
              set: groups,
            },
          },
        });
      } catch (updateError: any) {
        if (updateError.code === "P2025") {
          console.log(`User ${user} not found, creating new user`);
          await prisma.user.create({
            data: {
              username: user,
              groups: {
                set: groups,
              },
            },
          });
        } else {
          throw updateError;
        }
      }
    }
    console.log("All user groups updated");
  } catch (error) {
    console.error("Error updating user groups:", error);
  } finally {
    await prisma.$disconnect();
  }
}

export default async function GET(
  request: VercelRequest,
  response: VercelResponse
) {
  const authHeader = request.headers.authorization || "";
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response.status(401).json({ success: false });
  }

  try {
    console.log("Cron job started");
    await updateAllUserGroups();
    console.log("Cron job completed");
    response.status(200).json({ message: "Cron job completed successfully" });
  } catch (error) {
    response.status(405).json({ error: "Method not allowed" });
  }
}
