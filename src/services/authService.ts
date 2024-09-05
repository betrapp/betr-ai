import axios from "axios";

interface AuthResponse {
  data: {
    token: string;
    expires_in: number;
  };
}

let authToken: string | null = null;
let tokenExpiration: number | null = null;

export async function getAuthToken(): Promise<string> {
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
