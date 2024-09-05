import { App, ExpressReceiver } from "@slack/bolt";

export function setupSlackApp() {
  const receiver = new ExpressReceiver({
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    processBeforeResponse: true,
  });

  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    receiver,
  });

  return { app, receiver };
}
