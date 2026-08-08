# Render Web Service Setup

This repository contains a Telegram bot that uses long polling and a small HTTP
health endpoint so it can run on Render's free Web Service.

## Render settings

Create a **Web Service** from this repository and select the branch
`replit-telegram-bot`.

You can use the included `render.yaml`, or enter these values manually:

- **Runtime:** Node
- **Plan:** Free
- **Build Command:**

  ```bash
  corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/telegram-bot run typecheck
  ```

- **Start Command:**

  ```bash
  pnpm --filter @workspace/telegram-bot run start
  ```

- **Health Check Path:** `/healthz`

## Required environment variables

Add these in Render under **Environment**:

| Variable | Value |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | The token from @BotFather |
| `ADMIN_TELEGRAM_ID` | Numeric Telegram user ID of the approving admin |

The admin can be changed at any time by changing `ADMIN_TELEGRAM_ID` and
redeploying the service. Do not put these values in source code or commit them
to GitHub.

## Telegram permissions

The bot must be:

- An admin in both required channels so membership checks work
- An admin in the deal group so it can delete the open-form prompt and pin
  completed deals
- Allowed to send messages in the group

The service listens on Render's `PORT` automatically and answers `/healthz`
with a 200 response. Telegram updates are received through long polling, so no
webhook URL is required.