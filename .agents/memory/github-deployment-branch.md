---
name: GitHub deployment branch
description: Why the Telegram bot uses a separate branch in the requested GitHub repository.
---

The requested GitHub repository already contained a different bot project on
`main`. The Telegram ticket bot was pushed to `replit-telegram-bot` instead of
force-overwriting `main`.

**Why:** Protecting the existing repository history and code is safer than
replacing it when the two projects are unrelated.

**How to apply:** Use the `replit-telegram-bot` branch for Render deployment, or
merge that branch into the repository's main branch only after the owner
reviews the project-level coexistence decision.