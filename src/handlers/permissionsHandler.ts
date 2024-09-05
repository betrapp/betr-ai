import { SlackCommandMiddlewareArgs, AllMiddlewareArgs } from "@slack/bolt";
import {
  getUserGroups,
  updateUserGroupsInDB,
  getUserGroupsFromDB,
} from "../services/userService";

export async function handlePermissionsCommand({
  command,
  ack,
  respond,
  client,
}: SlackCommandMiddlewareArgs & AllMiddlewareArgs) {
  await ack();
  console.log("Acknowledged command");

  await respond({
    response_type: "ephemeral",
    text: ":hourglass: Fetching permissions... This may take a moment.",
  });

  try {
    const username = command.text.trim();
    console.log(`Processing command for username: ${username}`);

    let groups = await getUserGroupsFromDB(username);

    if (!groups) {
      // If not in DB, fetch from API and update DB
      groups = await getUserGroups(username);
      if (groups) {
        await updateUserGroupsInDB(username, groups);
      }
    }

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

    await client.chat.postMessage({
      channel: command.channel_id,
      text: resultMessage,
      thread_ts: command.ts,
      response_type: "ephemeral",
      user: command.user_id,
    });
    console.log("Sent result message");
  } catch (error) {
    console.error("Error in /permissions command:", error);
    const errorMessage = "An error occurred while fetching user data.";

    await client.chat.postMessage({
      channel: command.channel_id,
      text: errorMessage,
      thread_ts: command.ts,
      response_type: "ephemeral",
      user: command.user_id,
    });
    console.log("Sent error message");
  }
}
