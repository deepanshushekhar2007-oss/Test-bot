# Telegram Deal Ticket Bot

A Telegram bot that manages deal/escrow tickets in groups. Users run `/ticket` in a group, fill a 6-step form in DM, and the admin approves the deal — notifying the group when complete.

## Run & Operate

- `pnpm --filter @workspace/telegram-bot run dev` — run the Telegram bot (uses long polling)
- Render Web Service build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/telegram-bot run typecheck`
- Render Web Service start: `pnpm --filter @workspace/telegram-bot run start`
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Telegram: grammy v1 (long polling)
- Bot state: in-memory Maps (sessions + completed tickets)

## Where things live

- `artifacts/telegram-bot/src/index.ts` — all bot handlers (commands, form steps, admin approval)
- `artifacts/telegram-bot/src/messages.ts` — all message templates (small-caps Unicode font)
- `artifacts/telegram-bot/src/font.ts` — `sc()` small-caps converter
- `artifacts/telegram-bot/src/types.ts` — `SessionData` and `CompletedTicket` interfaces

## Bot Flow

1. User sends `/ticket` in group → bot posts message with "Open Ticket Form" URL button
2. Button opens `t.me/BOT?start=tkt_GROUPID` → DM session starts
3. 6-step form in DM: Item → Buyer → Seller → Amount+Currency → Exchange Rate → Deal Admin
4. Group prompt disappears when the creator opens the private form
5. Ticket creator can share the ticket with buyer and seller; each selects their role and confirms
6. Creator can confirm Complete, report Scam, or Cancel (each has a confirmation step)
7. Admin receives **Approve** only after creator, buyer, and seller confirmations
8. Admin clicks Approve → group gets a pinned closure message with deal details

## User preferences

- All bot messages in small-caps Unicode font (ᴀʙᴄ style)
- Messages in English

## Gotchas

- `TELEGRAM_BOT_TOKEN` and `ADMIN_TELEGRAM_ID` must be set as Replit Secrets
- `ADMIN_TELEGRAM_ID` must be the numeric user ID (get it from @userinfobot), not a username
- On Render, set `TELEGRAM_BOT_TOKEN` and `ADMIN_TELEGRAM_ID` in the Environment tab; changing `ADMIN_TELEGRAM_ID` changes the approving admin after redeploy
- Render's `render.yaml` configures a free Web Service and `/healthz` health check
- Bot must be added to the group as a member (doesn't need admin rights to post)
- Bot must be an admin in both required channels to verify membership, and a group admin to pin completed deals and delete prompts
- In-memory state: sessions and tickets reset on bot restart

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
