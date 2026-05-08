import { prisma } from "../lib/prisma";

export type WebhookEventType =
  | "ENTRY_SUBMITTED"
  | "ENTRY_APPROVED"
  | "ENTRY_REJECTED"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED";

interface WebhookPayload {
  event: WebhookEventType;
  userName: string;
  detail: string;
  timestamp: string;
}

function buildSlackBody(payload: WebhookPayload): object {
  const icon =
    payload.event === "ENTRY_APPROVED" || payload.event === "LEAVE_APPROVED" ? "✅" :
    payload.event === "ENTRY_REJECTED" || payload.event === "LEAVE_REJECTED" ? "❌" : "📋";
  return {
    text: `${icon} *Timera Bildirimi*`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${icon} *${payload.userName}* — ${payload.detail}`,
        },
      },
      {
        type: "context",
        elements: [{ type: "plain_text", text: payload.timestamp }],
      },
    ],
  };
}

function buildTeamsBody(payload: WebhookPayload): object {
  const color =
    payload.event === "ENTRY_APPROVED" || payload.event === "LEAVE_APPROVED" ? "Good" :
    payload.event === "ENTRY_REJECTED" || payload.event === "LEAVE_REJECTED" ? "Attention" : "Accent";
  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: color === "Good" ? "16A34A" : color === "Attention" ? "E8302A" : "F4631E",
    summary: "Timera Bildirimi",
    sections: [
      {
        activityTitle: `**${payload.userName}**`,
        activityText: payload.detail,
        facts: [{ name: "Zaman", value: payload.timestamp }],
      },
    ],
  };
}

async function sendToUrl(url: string, type: "SLACK" | "TEAMS", payload: WebhookPayload): Promise<void> {
  const body = type === "SLACK" ? buildSlackBody(payload) : buildTeamsBody(payload);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error(`[webhook] ${type} ${url} returned ${res.status}`);
  }
}

export async function fireWebhookEvent(event: WebhookEventType, payload: Omit<WebhookPayload, "event" | "timestamp">): Promise<void> {
  try {
    const hooks = await prisma.webhookConfig.findMany({
      where: { isActive: true, events: { has: event } },
    });
    if (hooks.length === 0) return;

    const timestamp = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
    const full: WebhookPayload = { event, timestamp, ...payload };

    await Promise.allSettled(
      hooks.map((h) => sendToUrl(h.url, h.type, full))
    );
  } catch (err) {
    console.error("[webhook] fireWebhookEvent error:", err);
  }
}
