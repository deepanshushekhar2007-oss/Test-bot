import { Bot, InlineKeyboard } from "grammy";
import { sc } from "./font";
import type { SessionData, CompletedTicket } from "./types";
import {
  formatGroupTicketRequest,
  formatGroupTicketStarted,
  formatStepPrompt,
  formatTicketSummary,
  formatAdminNotification,
  formatGroupApproval,
  formatGroupScamReport,
  formatGroupCancellation,
  formatSharedTicket,
  formatDealCompleteRolePrompt,
  formatPartyConfirmation,
} from "./messages";

// ── Environment ───────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID_RAW = process.env.ADMIN_TELEGRAM_ID;

if (!BOT_TOKEN) {
  console.error("❌  TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}
if (!ADMIN_ID_RAW) {
  console.error("❌  ADMIN_TELEGRAM_ID is not set");
  process.exit(1);
}

const ADMIN_ID = parseInt(ADMIN_ID_RAW, 10);
if (isNaN(ADMIN_ID)) {
  console.error("❌  ADMIN_TELEGRAM_ID must be a numeric Telegram user ID");
  process.exit(1);
}

const REQUIRED_CHANNELS = [
  { chatId: "@Files_Fusion", url: "https://t.me/Files_Fusion" },
  { chatId: "-1002331025603", url: "https://t.me/+pCvqZhgGTTs3ZmM1" },
] as const;

const JOIN_TEXT = [
  `🔐  ${sc("Channel membership required")}`,
  "",
  sc("Please join both required channels before using the ticket system."),
  "",
  `1. ${sc("Files Fusion")}`,
  `2. ${sc("Private Verification Channel")}`,
].join("\n");

// ── Bot setup ─────────────────────────────────────────────────────────────────

const bot = new Bot(BOT_TOKEN);

let botUsername = "";
let ticketCounter = 1;

/** Active form sessions: userId → current session state */
const sessions = new Map<number, SessionData>();

/** Completed tickets waiting for admin approval: ticketId → ticket */
const completedTickets = new Map<string, CompletedTicket>();

/** Group messages with an open-form link, keyed by group and requesting user. */
const pendingOpenMessages = new Map<string, number>();

/** Role selected by a buyer/seller before pressing the final confirmation button. */
const roleSelections = new Map<
  number,
  { ticketId: string; role: "buyer" | "seller"; action: "share" | "complete" }
>();

function generateTicketId(): string {
  return String(ticketCounter++).padStart(6, "0");
}

function membershipKeyboard(userId: number): InlineKeyboard {
  return new InlineKeyboard()
    .url(`1️⃣  ${sc("Join Files Fusion")}`, REQUIRED_CHANNELS[0].url)
    .row()
    .url(`2️⃣  ${sc("Join Private Channel")}`, REQUIRED_CHANNELS[1].url)
    .row()
    .text(`🔄  ${sc("Verify Membership")}`, `verify_access_${userId}`);
}

async function isMember(chatId: string, userId: number): Promise<boolean> {
  try {
    const member = await bot.api.getChatMember(chatId, userId);
    return (
      member.status === "creator" ||
      member.status === "administrator" ||
      member.status === "member" ||
      (member.status === "restricted" && member.is_member)
    );
  } catch (err) {
    console.error(`Membership check failed for ${chatId}:`, (err as Error).message);
    return false;
  }
}

async function hasRequiredMembership(userId: number): Promise<boolean> {
  const results = await Promise.all(
    REQUIRED_CHANNELS.map((channel) => isMember(channel.chatId, userId))
  );
  return results.every(Boolean);
}

function shareTicketUrl(ticketId: string): string {
  const deepLink = `https://t.me/${botUsername}?start=share_${ticketId}`;
  return `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(
    sc("Please confirm your role on this deal ticket.")
  )}`;
}

function pendingTicketKeyboard(ticket: CompletedTicket): InlineKeyboard {
  return new InlineKeyboard()
    .url(`📤  ${sc("Share Ticket")}`, shareTicketUrl(ticket.ticketId))
    .row()
    .text(`✅  ${sc("Deal Complete")}`, `user_complete_${ticket.ticketId}`)
    .row()
    .text(`🚨  ${sc("Scam Deal")}`, `user_scam_${ticket.ticketId}`)
    .row()
    .text(`❌  ${sc("Cancel Deal")}`, `user_cancel_${ticket.ticketId}`);
}

function actionConfirmationKeyboard(
  ticketId: string,
  action: "complete" | "scam" | "cancel"
): InlineKeyboard {
  return new InlineKeyboard()
    .url(`📤  ${sc("Share Ticket")}`, shareTicketUrl(ticketId))
    .row()
    .text(`✅  ${sc("Confirm")} ${sc(action)}`, `confirm_${action}_${ticketId}`)
    .row()
    .text(`↩️  ${sc("Go Back")}`, `back_ticket_${ticketId}`);
}

function roleKeyboard(
  ticketId: string,
  action: "share" | "complete" = "share"
): InlineKeyboard {
  return new InlineKeyboard()
    .url(`📤  ${sc("Share Ticket")}`, shareTicketUrl(ticketId))
    .row()
    .text(`🛒  ${sc("I am the Buyer")}`, `role_${action}_buyer_${ticketId}`)
    .row()
    .text(`💰  ${sc("I am the Seller")}`, `role_${action}_seller_${ticketId}`);
}

function roleConfirmationKeyboard(
  ticketId: string,
  role: "buyer" | "seller",
  action: "share" | "complete"
): InlineKeyboard {
  return new InlineKeyboard()
    .url(`📤  ${sc("Share Ticket")}`, shareTicketUrl(ticketId))
    .row()
    .text(
      `✅  ${sc("Confirm")} ${sc(role)}`,
      `confirm_role_${action}_${role}_${ticketId}`
    );
}

function shareOnlyKeyboard(ticketId: string): InlineKeyboard {
  return new InlineKeyboard().url(
    `📤  ${sc("Share Ticket")}`,
    shareTicketUrl(ticketId)
  );
}

async function notifyAdminIfReady(ticket: CompletedTicket): Promise<void> {
  if (
    ticket.adminNotified ||
    !ticket.creatorCompleteConfirmed ||
    !ticket.buyerConfirmed ||
    !ticket.sellerConfirmed
  ) {
    return;
  }

  const adminKeyboard = new InlineKeyboard().text(
    `✅  ${sc("Approve Deal")}`,
    `approve_${ticket.ticketId}`
  );
  await bot.api.sendMessage(ADMIN_ID, formatAdminNotification(ticket), {
    reply_markup: adminKeyboard,
  });
  ticket.adminNotified = true;
}

// Fetch bot username on startup for deep-link construction
bot.api
  .getMe()
  .then((me) => {
    botUsername = me.username ?? "";
    console.log(`✅  Bot @${botUsername} connected`);
    console.log(`👑  Admin ID: ${ADMIN_ID}`);
  })
  .catch((err: Error) => {
    console.error("Failed to connect to Telegram:", err.message);
    process.exit(1);
  });

// ── /ticket — Group command ───────────────────────────────────────────────────

bot.command("ticket", async (ctx) => {
  const chat = ctx.chat;

  if (!chat || chat.type === "private") {
    await ctx.reply(
      `⚠️  ${sc("Please use this command inside a group!")}`
    );
    return;
  }

  const requesterId = ctx.from!.id;
  if (!(await hasRequiredMembership(requesterId))) {
    await ctx.reply(JOIN_TEXT, {
      reply_markup: membershipKeyboard(requesterId),
    });
    return;
  }

  if (!botUsername) {
    await ctx.reply(sc("Bot is still starting up. Please try again shortly."));
    return;
  }

  const groupId = chat.id;
  const keyboard = new InlineKeyboard().url(
    `📋  ${sc("Open Ticket Form")}`,
    `https://t.me/${botUsername}?start=tkt_${groupId}_${requesterId}`
  );

  const key = `${groupId}:${requesterId}`;
  const oldMessageId = pendingOpenMessages.get(key);
  if (oldMessageId) {
    try {
      await bot.api.deleteMessage(groupId, oldMessageId);
    } catch {
      // It may already have been deleted by a group moderator.
    }
  }
  const sentMessage = await ctx.reply(formatGroupTicketRequest(), {
    reply_markup: keyboard,
  });
  pendingOpenMessages.set(key, sentMessage.message_id);
});

// ── /start — DM: begin form ───────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  if (ctx.chat.type !== "private") return;

  const payload = ctx.match ?? "";
  const userId = ctx.from!.id;

  if (!(await hasRequiredMembership(userId))) {
    await ctx.reply(JOIN_TEXT, {
      reply_markup: membershipKeyboard(userId),
    });
    return;
  }

  if (payload.startsWith("share_")) {
    const ticketId = payload.slice("share_".length);
    const ticket = completedTickets.get(ticketId);
    if (!ticket) {
      await ctx.reply(`⚠️  ${sc("This ticket is closed or no longer available.")}`);
      return;
    }
    await ctx.reply(formatSharedTicket(ticket), {
      reply_markup: roleKeyboard(ticket.ticketId, "share"),
    });
    return;
  }

  // Regular /start with no payload
  if (!payload.startsWith("tkt_")) {
    await ctx.reply(
      [
        `👋  ${sc("Welcome!")}`,
        "",
        sc("Use /ticket in any group to open a deal ticket."),
        sc("I will walk you through a short form in our private chat."),
      ].join("\n")
    );
    return;
  }

  // Deep-link start from group button
  const parts = payload.slice(4).split("_"); // strip "tkt_"
  const groupId = parseInt(parts[0], 10);
  const creatorId = parseInt(parts[1] ?? "", 10);
  if (isNaN(groupId) || isNaN(creatorId) || creatorId !== userId) {
    await ctx.reply(
      `⚠️  ${sc("Invalid ticket link. Please use /ticket in a group and try again.")}`
    );
    return;
  }

  // Remove the group prompt as soon as its creator opens the private form.
  const promptKey = `${groupId}:${userId}`;
  const promptMessageId = pendingOpenMessages.get(promptKey);
  if (promptMessageId) {
    try {
      await bot.api.deleteMessage(groupId, promptMessageId);
    } catch (err) {
      console.error("Could not delete the group form prompt:", (err as Error).message);
    }
    pendingOpenMessages.delete(promptKey);
  }

  // Prevent duplicate sessions
  if (sessions.has(userId)) {
    await ctx.reply(
      `⚠️  ${sc("You already have an active ticket form.")}\n` +
        sc("Please complete it, or type /cancel to start over.")
    );
    return;
  }

  const ticketId = generateTicketId();
  const session: SessionData = {
    step: 1,
    groupId,
    ticketId,
    userId,
    firstName: ctx.from!.first_name,
    username: ctx.from!.username,
    commodity: "",
    buyer: "",
    seller: "",
    amount: "",
    currency: "",
    exchangeRate: "",
    facilitator: "",
    createdAt: new Date(),
  };

  sessions.set(userId, session);
  await bot.api.sendMessage(
    groupId,
    formatGroupTicketStarted(
      ctx.from!.first_name,
      ctx.from!.username,
      ticketId
    )
  );
  await ctx.reply(formatStepPrompt(1, ticketId));
});

// ── /cancel — Abort active form ───────────────────────────────────────────────

bot.command("cancel", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  const userId = ctx.from!.id;

  if (sessions.delete(userId)) {
    await ctx.reply(
      `❌  ${sc("Ticket form cancelled.")}\n` +
        sc("Use /ticket in a group to start a new one.")
    );
  } else {
    await ctx.reply(sc("No active ticket form to cancel."));
  }
});

// ── Text messages — Multi-step form handler ───────────────────────────────────

bot.on("message:text", async (ctx) => {
  if (ctx.chat.type !== "private") return;

  const userId = ctx.from!.id;
  const session = sessions.get(userId);
  if (!session) return; // No active form; ignore

  const text = ctx.message.text.trim();

  // Let /cancel pass through to its own handler
  if (text.startsWith("/")) return;

  if (!text) {
    await ctx.reply(`⚠️  ${sc("Please enter a valid answer.")}`);
    return;
  }

  switch (session.step) {
    // Step 1 — Commodity / Item
    case 1:
      session.commodity = text;
      session.step = 2;
      await ctx.reply(formatStepPrompt(2, session.ticketId));
      break;

    // Step 2 — Buyer
    case 2:
      session.buyer = text;
      session.step = 3;
      await ctx.reply(formatStepPrompt(3, session.ticketId));
      break;

    // Step 3 — Seller
    case 3:
      session.seller = text;
      session.step = 4;
      await ctx.reply(formatStepPrompt(4, session.ticketId));
      break;

    // Step 4 — Amount + Currency (e.g. "5000 INR" or "0.5 BTC")
    case 4: {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await ctx.reply(
          `⚠️  ${sc("Please include the currency after the amount.")}\n\n` +
            `${sc("Format")}: 5000 INR  |  100 USDT  |  0.5 BTC`
        );
        return; // Don't advance step
      }
      session.amount = parts[0];
      session.currency = parts.slice(1).join(" ").toUpperCase();
      session.step = 5;
      await ctx.reply(formatStepPrompt(5, session.ticketId));
      break;
    }

    // Step 5 — Exchange Rate
    case 5:
      session.exchangeRate = text;
      session.step = 6;
      await ctx.reply(formatStepPrompt(6, session.ticketId));
      break;

    // Step 6 — Deal Admin / Facilitator (final step)
    case 6: {
      session.facilitator = text;
      sessions.delete(userId); // Form complete; remove session

      const completed: CompletedTicket = {
        ...session,
        facilitator: text,
        creatorCompleteConfirmed: false,
        buyerConfirmed: false,
        sellerConfirmed: false,
        adminNotified: false,
      };
      completedTickets.set(session.ticketId, completed);

      await ctx.reply(formatTicketSummary(completed), {
        reply_markup: pendingTicketKeyboard(completed),
      });
      return; // Session already deleted; skip the set below
    }
  }

  // Persist updated session
  sessions.set(userId, session);
});

// ── Callback queries — access, shared tickets, confirmations & approval ───────

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith("verify_access_")) {
    if (await hasRequiredMembership(ctx.from.id)) {
      await ctx.editMessageText(
        `✅  ${sc("Membership verified.")}\n\n` +
          sc("You can now use the ticket system.")
      );
      await ctx.answerCallbackQuery({ text: "✅  Access verified." });
    } else {
      await ctx.answerCallbackQuery({
        text: "⚠️  Please join both channels first.",
        show_alert: true,
      });
    }
    return;
  }

  if (data.startsWith("open_form_")) {
    const requesterId = Number(data.slice("open_form_".length));
    if (ctx.from.id !== requesterId) {
      await ctx.answerCallbackQuery({
        text: "⛔  Only the person who used /ticket can open this form.",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery({
      text: "📩  Open the private chat button to fill the form.",
    });
    return;
  }

  const roleMatch = data.match(/^role_(share|complete)_(buyer|seller)_(.+)$/);
  if (roleMatch) {
    const action = roleMatch[1] as "share" | "complete";
    const role = roleMatch[2] as "buyer" | "seller";
    const ticketId = roleMatch[3];
    const ticket = completedTickets.get(ticketId);
    if (!ticket) {
      await ctx.answerCallbackQuery({ text: "⚠️  Ticket is closed.", show_alert: true });
      return;
    }
    const claimedId = role === "buyer" ? ticket.buyerUserId : ticket.sellerUserId;
    if (claimedId && claimedId !== ctx.from.id) {
      await ctx.answerCallbackQuery({
        text: `⛔  The ${role} role is already confirmed by another user.`,
        show_alert: true,
      });
      return;
    }
    roleSelections.set(ctx.from.id, { ticketId, role, action });
    await ctx.editMessageText(formatPartyConfirmation(ticket, role), {
      reply_markup: roleConfirmationKeyboard(ticketId, role, action),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  const roleConfirmMatch = data.match(
    /^confirm_role_(share|complete)_(buyer|seller)_(.+)$/
  );
  if (roleConfirmMatch) {
    const action = roleConfirmMatch[1] as "share" | "complete";
    const role = roleConfirmMatch[2] as "buyer" | "seller";
    const ticketId = roleConfirmMatch[3];
    const ticket = completedTickets.get(ticketId);
    const selection = roleSelections.get(ctx.from.id);
    if (
      !ticket ||
      !selection ||
      selection.ticketId !== ticketId ||
      selection.role !== role ||
      selection.action !== action
    ) {
      await ctx.answerCallbackQuery({
        text: "⚠️  Please select your role again.",
        show_alert: true,
      });
      return;
    }
    const claimedId = role === "buyer" ? ticket.buyerUserId : ticket.sellerUserId;
    if (claimedId && claimedId !== ctx.from.id) {
      await ctx.answerCallbackQuery({
        text: "⛔  This role is already confirmed.",
        show_alert: true,
      });
      return;
    }
    if (role === "buyer") {
      ticket.buyerUserId = ctx.from.id;
      ticket.buyerConfirmed = true;
    } else {
      ticket.sellerUserId = ctx.from.id;
      ticket.sellerConfirmed = true;
    }
    if (action === "complete") {
      ticket.creatorCompleteConfirmed = true;
    }
    roleSelections.delete(ctx.from.id);
    await ctx.editMessageText(
      formatSharedTicket(ticket) +
        "\n\n" +
        `✅  ${sc(role)} ${sc("confirmed.")}\n` +
        `⏳  ${sc("Waiting for the other party and ticket creator.")}`,
      { reply_markup: shareOnlyKeyboard(ticketId) }
    );
    try {
      await notifyAdminIfReady(ticket);
    } catch (err) {
      console.error("Failed to notify admin:", (err as Error).message);
    }
    await ctx.answerCallbackQuery({ text: `✅  ${role} confirmation saved.` });
    return;
  }

  const backMatch = data.match(/^back_ticket_(.+)$/);
  if (backMatch) {
    const ticket = completedTickets.get(backMatch[1]);
    if (!ticket || ctx.from.id !== ticket.userId) {
      await ctx.answerCallbackQuery({ text: "⛔  Not your ticket.", show_alert: true });
      return;
    }
    await ctx.editMessageText(formatTicketSummary(ticket), {
      reply_markup: pendingTicketKeyboard(ticket),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  const actionMatch = data.match(/^user_(complete|scam|cancel)_(.+)$/);
  if (actionMatch) {
    const ticketId = actionMatch[2];
    const ticket = completedTickets.get(ticketId);
    if (!ticket || ctx.from.id !== ticket.userId) {
      await ctx.answerCallbackQuery({
        text: "⛔  Only the ticket creator can choose this.",
        show_alert: true,
      });
      return;
    }
    const action = actionMatch[1] as "complete" | "scam" | "cancel";
    if (action === "complete") {
      await ctx.editMessageText(formatDealCompleteRolePrompt(ticket), {
        reply_markup: roleKeyboard(ticketId, "complete"),
      });
      await ctx.answerCallbackQuery();
      return;
    }

    await ctx.editMessageText(
      formatTicketSummary(ticket) +
        "\n\n" +
        `⚠️  ${sc(`Confirm ${action.toUpperCase()}? This action cannot be undone.`)}`,
      { reply_markup: actionConfirmationKeyboard(ticketId, action) }
    );
    await ctx.answerCallbackQuery();
    return;
  }

  const confirmMatch = data.match(/^confirm_(complete|scam|cancel)_(.+)$/);
  if (confirmMatch) {
    const ticketId = confirmMatch[2];
    const ticket = completedTickets.get(ticketId);
    if (!ticket || ctx.from.id !== ticket.userId) {
      await ctx.answerCallbackQuery({
        text: "⛔  Only the ticket creator can confirm this.",
        show_alert: true,
      });
      return;
    }
    const action = confirmMatch[1] as "complete" | "scam" | "cancel";
    const groupMessage = action === "scam"
      ? await bot.api.sendMessage(ticket.groupId, formatGroupScamReport(ticket))
      : await bot.api.sendMessage(ticket.groupId, formatGroupCancellation(ticket));
    void groupMessage;
    await ctx.editMessageText(
      formatTicketSummary(ticket) +
        "\n\n" +
        `✅  ${sc(action === "scam" ? "SCAM REPORTED — TICKET CLOSED" : "DEAL CANCELLED — TICKET CLOSED")}`
    );
    completedTickets.delete(ticketId);
    await ctx.answerCallbackQuery({
      text: action === "scam" ? "🚨  Scam reported. Ticket closed." : "❌  Deal cancelled.",
    });
    return;
  }

  const isAdminApproval = data.startsWith("approve_");
  if (!isAdminApproval) {
    await ctx.answerCallbackQuery();
    return;
  }
  if (ctx.from.id !== ADMIN_ID) {
    await ctx.answerCallbackQuery({
      text: "⛔  You are not authorized to approve tickets.",
      show_alert: true,
    });
    return;
  }

  const ticketId = data.slice("approve_".length);
  const ticket = completedTickets.get(ticketId);
  if (!ticket) {
    await ctx.answerCallbackQuery({
      text: "⚠️  Ticket not found or already processed.",
      show_alert: true,
    });
    return;
  }
  if (!ticket.creatorCompleteConfirmed || !ticket.buyerConfirmed || !ticket.sellerConfirmed) {
    await ctx.answerCallbackQuery({
      text: "⚠️  Creator, buyer and seller must all confirm first.",
      show_alert: true,
    });
    return;
  }

  let groupMessage;
  try {
    groupMessage = await bot.api.sendMessage(ticket.groupId, formatGroupApproval(ticket));
    try {
      await bot.api.pinChatMessage(ticket.groupId, groupMessage.message_id, {
        disable_notification: false,
      });
    } catch (err) {
      console.error("Could not pin completed deal; bot needs group admin rights:", (err as Error).message);
    }
  } catch (err) {
    console.error("Failed to post approval to group:", (err as Error).message);
    await ctx.answerCallbackQuery({
      text: "❌  Could not post to group. Bot may be missing permissions.",
      show_alert: true,
    });
    return;
  }

  const approvedMsg =
    formatAdminNotification(ticket) +
    "\n\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    `✅  ${sc("APPROVED — DEAL VERIFIED & CLOSED")}\n` +
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
  await ctx.editMessageText(approvedMsg, { reply_markup: undefined });
  completedTickets.delete(ticketId);
  await ctx.answerCallbackQuery({
    text: "✅  Deal approved, posted and pinned in the group.",
  });
});

// ── Error handler ─────────────────────────────────────────────────────────────

bot.catch((err) => {
  const cause = err.error;
  if (cause instanceof Error) {
    console.error("Bot error:", cause.message);
  } else {
    console.error("Bot error:", err);
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

console.log("🚀  Starting Telegram bot...");
bot.start({
  onStart: (info) => {
    console.log(`✅  @${info.username} is live and listening`);
  },
});
