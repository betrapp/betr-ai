import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { getAuthToken, updateUserGroupsInDB, UsersResponse } from "./index"; // Adjust path as necessary

const prisma = new PrismaClient();

export default async function scheduledUserGroupsUpdate(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "POST") {
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
      res.status(200).send("Daily user group update completed");
    } catch (error) {
      console.error("Error updating user groups:", error);
      res.status(500).send("Failed to update user groups");
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
}
