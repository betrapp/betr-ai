import { getAuthToken } from "./api/index";
import { updateUserGroupsInDB } from "./api/index";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface UsersResponse {
  data: {
    [key: string]: {
      uuid: string;
      username: string;
      groups: string[];
      [key: string]: any; // Any additional properties from the API response
    };
  };
}

// Function to fetch all users and their groups
async function getAllUsersGroups(): Promise<UsersResponse> {
  try {
    const token = await getAuthToken(); // Get the auth token
    console.log("Token received:", token);

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

    return response.data;
  } catch (error) {
    console.error("Error fetching users data:", error);
    throw error;
  }
}

// Function to fetch all user data from API and update DB
async function updateAllUsersInDB() {
  try {
    // Fetch all users and their groups from the API
    const usersData = await getAllUsersGroups();

    console.log("Fetched users data:", usersData);

    // Iterate over each user and update their groups in the DB
    for (const [username, userData] of Object.entries(usersData.data)) {
      const groups = userData.groups;

      // Update each user's groups in the DB
      await updateUserGroupsInDB(username, groups);

      console.log(`Updated ${username} with groups:`, groups);
    }

    console.log("All users updated successfully.");
  } catch (error) {
    console.error("Error updating users in DB:", error);
  }
}

// Example usage: Call the function to update all users in the DB
updateAllUsersInDB();
