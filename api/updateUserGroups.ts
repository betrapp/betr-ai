import { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { getUserGroups, UsersResponse } from "../src/services/userService";
import { getAuthToken } from "../src/services/authService";
import { updateUserGroupsInDB } from "../src/services/userService";

export default async function updateUserGroups(
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
      res.status(200).send("User groups updated successfully");
    } catch (error) {
      console.error("Error during user groups update:", error);
      res.status(500).send("Failed to update user groups");
    }
  } else {
    res.status(405).send("Method Not Allowed");
  }
}
