import { sc } from "./font";
import { CompletedTicket } from "./types";

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
const TOTAL_STEPS = 6;

/** Build a ▓░░░░░ style progress bar */
function progressBar(step: number): string {
  return "▓".repeat(step) + "░".repeat(TOTAL_STEPS - step);
}

/** Format date nicely */
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Group message when /ticket is used ──────────────────────────────────────

export function formatGroupTicketRequest(): string {
  return [
    DIVIDER,
    `🎫  ${sc("Ticket System")}`,
    DIVIDER,
    "",
    sc("A new deal ticket has been requested in this group."),
    "",
    sc("Click the button below to fill in the ticket details"),
    sc("in our private chat. It only takes a minute!"),
    "",
    `⚡ ${sc("Secure")}  ·  ${sc("Fast")}  ·  ${sc("Admin-Verified")}`,
    DIVIDER,
  ].join("\n");
}

// ── Step prompts ─────────────────────────────────────────────────────────────

const STEP_QUESTIONS: Record<number, { icon: string; question: string; hint: string }> = {
  1: {
    icon: "📦",
    question: sc("What item / commodity is being dealt?"),
    hint: `${sc("Example")}: Gold, BTC, USD, Property, USDT...`,
  },
  2: {
    icon: "🛒",
    question: sc("Who is the BUYER?"),
    hint: sc("Enter the buyer's name or @username."),
  },
  3: {
    icon: "💰",
    question: sc("Who is the SELLER?"),
    hint: sc("Enter the seller's name or @username."),
  },
  4: {
    icon: "💵",
    question: sc("What is the deal amount & currency?"),
    hint:
      `${sc("Format")}: 5000 INR  |  100 USDT  |  0.5 BTC\n` +
      sc("Always include the currency after the amount."),
  },
  5: {
    icon: "📈",
    question: sc("What is the exchange rate?"),
    hint: `${sc("Example")}: 1 USD = 84 INR  |  1 BTC = 65000 USD  |  N/A`,
  },
  6: {
    icon: "👤",
    question: sc("Who is the deal admin / facilitator?"),
    hint: sc("Enter the @username of the person managing this deal."),
  },
};

export function formatStepPrompt(step: number, ticketId: string): string {
  const bar = progressBar(step);
  const q = STEP_QUESTIONS[step];

  return [
    DIVIDER,
    `🎫 ${sc("Ticket")} #${ticketId}`,
    "",
    `📊 ${sc("Step")} ${step} ${sc("of")} ${TOTAL_STEPS}   [ ${bar} ]`,
    DIVIDER,
    "",
    `${q.icon}  ${q.question}`,
    "",
    q.hint,
    "",
    DIVIDER,
  ].join("\n");
}

// ── Full ticket summary (sent to user after form is complete) ────────────────

export function formatTicketSummary(t: CompletedTicket): string {
  return [
    DIVIDER,
    `🎫  ${sc("Deal Ticket")}`,
    DIVIDER,
    `   ${sc("Ticket Number")}  :  #${t.ticketId}`,
    DIVIDER,
    "",
    `📦  ${sc("Item")}          :  ${t.commodity}`,
    `🛒  ${sc("Buyer")}         :  ${t.buyer}`,
    `💰  ${sc("Seller")}        :  ${t.seller}`,
    `💵  ${sc("Amount")}        :  ${t.amount} ${t.currency}`,
    `📈  ${sc("Exchange Rate")} :  ${t.exchangeRate}`,
    `👤  ${sc("Deal Admin")}    :  ${t.facilitator}`,
    `📅  ${sc("Date")}          :  ${fmtDate(t.createdAt)}`,
    `🔄  ${sc("Status")}        :  🟡 ${sc("Deal In Progress")}`,
    "",
    DIVIDER,
    "",
    `⏳  ${sc("Choose an option below when the deal is finished.")}`,
    "",
    DIVIDER,
  ].join("\n");
}

export function formatSharedTicket(t: CompletedTicket): string {
  return [
    DIVIDER,
    `🎫  ${sc("Shared Deal Ticket")}`,
    DIVIDER,
    `   ${sc("Ticket Number")}  :  #${t.ticketId}`,
    DIVIDER,
    "",
    `📦  ${sc("Item")}          :  ${t.commodity}`,
    `🛒  ${sc("Buyer")}         :  ${t.buyer}`,
    `💰  ${sc("Seller")}        :  ${t.seller}`,
    `💵  ${sc("Amount")}        :  ${t.amount} ${t.currency}`,
    `📈  ${sc("Exchange Rate")} :  ${t.exchangeRate}`,
    `👤  ${sc("Deal Admin")}    :  ${t.facilitator}`,
    "",
    sc("Please choose your role and confirm the ticket details."),
    DIVIDER,
  ].join("\n");
}

export function formatPartyConfirmation(
  t: CompletedTicket,
  role: "buyer" | "seller"
): string {
  const party = role === "buyer" ? sc("BUYER") : sc("SELLER");
  return [
    DIVIDER,
    `⚠️  ${sc("Confirm Your Role")}`,
    DIVIDER,
    "",
    `${sc("You are confirming that you are the")} ${party}.`,
    sc("Please check every ticket detail before confirming."),
    "",
    `🎫  ${sc("Ticket")} #${t.ticketId}`,
    `📦  ${sc("Item")}      :  ${t.commodity}`,
    `💵  ${sc("Amount")}    :  ${t.amount} ${t.currency}`,
    `🛒  ${sc("Buyer")}     :  ${t.buyer}`,
    `💰  ${sc("Seller")}    :  ${t.seller}`,
    "",
    `⚠️  ${sc("Confirm only if these details are correct.")}`,
    DIVIDER,
  ].join("\n");
}

// ── Group messages for user-selected outcomes ─────────────────────────────────

export function formatGroupScamReport(t: CompletedTicket): string {
  return [
    DIVIDER,
    `🚨  ${sc("Ticket Closed — Scam Deal Report")}`,
    DIVIDER,
    `   ${sc("Ticket Number")}  :  #${t.ticketId}`,
    DIVIDER,
    "",
    `⚠️  ${sc("This deal was reported as a scam by the ticket creator.")}`,
    "",
    `📦  ${sc("Item")}          :  ${t.commodity}`,
    `🛒  ${sc("Buyer")}         :  ${t.buyer}`,
    `💰  ${sc("Seller")}        :  ${t.seller}`,
    `💵  ${sc("Amount")}        :  ${t.amount} ${t.currency}`,
    `📈  ${sc("Exchange Rate")} :  ${t.exchangeRate}`,
    `👤  ${sc("Deal Admin")}    :  ${t.facilitator}`,
    `📅  ${sc("Date")}          :  ${fmtDate(t.createdAt)}`,
    "",
    `🚨  ${sc("Buyer, seller and deal admin have been reported.")}`,
    `🔒  ${sc("Ticket Closed — Deal Not Completed")}`,
    DIVIDER,
  ].join("\n");
}

export function formatGroupCancellation(t: CompletedTicket): string {
  return [
    DIVIDER,
    `❌  ${sc("Ticket Closed — Deal Cancelled")}  —  #${t.ticketId}`,
    DIVIDER,
    "",
    sc("The ticket creator cancelled this deal."),
    sc("No admin approval or decline is required."),
    "",
    `📦  ${sc("Item")}   :  ${t.commodity}`,
    `🛒  ${sc("Buyer")}  :  ${t.buyer}`,
    `💰  ${sc("Seller")} :  ${t.seller}`,
    `💵  ${sc("Amount")} :  ${t.amount} ${t.currency}`,
    "",
    `🔒  ${sc("Ticket Closed — Deal Cancelled")}`,
    DIVIDER,
  ].join("\n");
}

// ── Admin notification ────────────────────────────────────────────────────────

export function formatAdminNotification(t: CompletedTicket): string {
  const userTag = t.username ? `@${t.username}` : t.firstName;

  return [
    DIVIDER,
    `🚨  ${sc("New Ticket — Approval Required")}`,
    DIVIDER,
    `   ${sc("Ticket Number")}  :  #${t.ticketId}`,
    DIVIDER,
    "",
    `📦  ${sc("Item")}          :  ${t.commodity}`,
    `🛒  ${sc("Buyer")}         :  ${t.buyer}`,
    `💰  ${sc("Seller")}        :  ${t.seller}`,
    `💵  ${sc("Amount")}        :  ${t.amount} ${t.currency}`,
    `📈  ${sc("Exchange Rate")} :  ${t.exchangeRate}`,
    `👤  ${sc("Deal Admin")}    :  ${t.facilitator}`,
    `📅  ${sc("Date")}          :  ${fmtDate(t.createdAt)}`,
    "",
    `${sc("Submitted by")}  :  ${userTag}`,
    "",
    DIVIDER,
    "",
    sc("Both buyer and seller have confirmed. Review and approve the deal."),
    DIVIDER,
  ].join("\n");
}

// ── Group approval message (posted in group when admin approves) ─────────────

export function formatGroupApproval(t: CompletedTicket): string {
  return [
    DIVIDER,
    `✅  ${sc("Ticket Closed")}  —  #${t.ticketId}`,
    DIVIDER,
    "",
    `🎉  ${sc("DEAL SUCCESSFULLY COMPLETED")}`,
    `    ${sc("Verified & approved by admin.")}`,
    `    ${sc("Both parties have been confirmed.")}`,
    "",
    `📦  ${sc("Item")}   :  ${t.commodity}`,
    `🛒  ${sc("Buyer")}  :  ${t.buyer}`,
    `💰  ${sc("Seller")} :  ${t.seller}`,
    `💵  ${sc("Amount")} :  ${t.amount} ${t.currency}`,
    "",
    `✔️   ${sc("Verified by Admin")}   ·   🔒 ${sc("Ticket Closed")}`,
    DIVIDER,
  ].join("\n");
}
