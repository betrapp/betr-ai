import axios from "axios";
import { getAuthToken } from "../services/authService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

export interface UsersResponse {
  data: {
    [key: string]: User;
  };
}

export async function getUserGroups(
  username: string
): Promise<string[] | null> {
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

export async function updateUserGroupsInDB(username: string, groups: string[]) {
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

export async function getUserGroupsFromDB(
  username: string
): Promise<string[] | null> {
  const user = await prisma.user.findUnique({
    where: { username: username },
  });
  return user?.groups || null;
}
