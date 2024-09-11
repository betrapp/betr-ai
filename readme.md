---

# Slack Permissions Bot

This project is a Slack bot built with [Bolt for JavaScript](https://slack.dev/bolt-js) and deployed on Vercel. It provides a `/permissions` Slack command to fetch user group permissions from a PostgreSQL database, using Prisma as the ORM. The project includes a daily cron job that updates the database to avoid API timeouts.

## Features
- **Slack command `/permissions`**: Fetches and responds with user permissions based on the provided username.
- **Daily Cron Job**: Automatically updates user groups in the database every day at midnight.
- **Prisma ORM**: Manages database interaction with PostgreSQL.
- **Vercel deployment**: Hosted as a serverless function on Vercel, with cron jobs supported natively.

## Folder Structure
```
api/
  ├── cron/
  │   ├── index.ts              # Entry point for the cron job
  │   └── updateUserGroups.ts    # Logic for updating user groups in the DB
  ├── prisma/
  │   └── schema.prisma          # Prisma schema for DB models
  ├── src/
  │   ├── config/
  │   │   └── slackConfig.ts     # Slack app configuration
  │   ├── handlers/
  │   │   └── permissionsHandler.ts  # Handles /permissions Slack command
  │   ├── services/
  │   │   ├── authService.ts     # Auth related logic for API
  │   │   └── userService.ts     # Services for fetching and updating user groups


.env                    # Environment variables (excluded from version control)
.gitignore               # Ignoring sensitive files
package.json             # Dependencies and scripts
tsconfig.json            # TypeScript configuration
vercel.json              # Vercel configuration for builds, routes, and cron jobs
```

## Setup Instructions

### Prerequisites
- Node.js v16.x or higher
- A [Slack App](https://api.slack.com/apps) with required scopes (chat:write, commands)
- PostgreSQL database

### 1. Clone the repository
```bash
git clone https://github.com/your-repo/slack-permissions-bot.git
cd slack-permissions-bot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure the environment variables
Create a `.env` file in the root of the project with the following structure:

```bash
# Slack Credentials
SLACK_BOT_TOKEN=<your-slack-bot-token>
SLACK_SIGNING_SECRET=<your-slack-signing-secret>
SLACK_APP_TOKEN=<your-slack-app-token>

# API Credentials
API_USERNAME=<your-api-username>
API_PASSWORD=<your-api-password>
API_BASE_URL=<your-api-base-url>

# Database URLs
DATABASE_URL="<your-database-url>"
DIRECT_URL="<your-direct-database-url>"

# Cron Job Secret
CRON_SECRET=<your-cron-secret>
```

Make sure to replace the placeholders with your actual credentials.

### 4. Set up the database
Ensure your PostgreSQL database is set up and running. The schema is defined in `prisma/schema.prisma`.

Run the following command to apply the schema:

```bash
npx prisma migrate deploy
```

### 5. Running the bot locally
To run the bot locally, use the following command:

```bash
vercel dev
```

This will start the server locally using Vercel's serverless functions.

### 6. Deploying to Vercel
The bot is configured to be deployed using Vercel. Run the following commands:

```bash
vercel
```

Follow the instructions to link the project to your Vercel account and deploy it.

### 7. Vercel Configuration
The `vercel.json` file includes the build configuration, routing, and cron job scheduling. Below is a breakdown of its contents:

- **Builds**: Specifies the entry points for the API.
    ```json
    "builds": [
      { "src": "api/index.ts", "use": "@vercel/node" },
      { "src": "api/cron/index.ts", "use": "@vercel/node" }
    ]
    ```
- **Routes**: Defines how requests are routed within the app.
    ```json
    "routes": [
      { "src": "/api/cron", "methods": ["GET"], "dest": "/api/cron/index.ts" },
      { "src": "/api/cron/index.ts", "dest": "/api/cron/index.ts" },
      { "src": "/(.*)", "dest": "/api/index.ts" }
    ]
    ```
- **Cron Job**: Configured to run daily at midnight.
    ```json
    "crons": [
      {
        "path": "/api/cron/index.ts",
        "schedule": "0 0 * * *"
      }
    ]
    ```

To test the cron job locally, you can manually trigger it using:

```bash
npm run cron
```

## Slack Commands

### `/permissions`
- **Description**: Fetches the permissions/groups for a given user.
- **Usage**: `/permissions [username]`

  Example:
  ```
  /permissions john_doe
  ```

- **Response**: Displays the groups the user belongs to or indicates that the user was not found.

## .gitignore

The following files are ignored from version control:
```
.env
node_modules
package-lock.json
.vercel
.env-local
```

## Contributing
Feel free to submit issues or pull requests if you find any bugs or want to contribute to the project.

## License
This project is licensed under the MIT License.

---
