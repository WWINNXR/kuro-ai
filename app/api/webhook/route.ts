import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { getOrCreateUser } from "@/lib/supabase";
import { parseMessage } from "@/lib/openai";
import { handleReminder } from "@/lib/handlers/reminder";
import {
  handleCreateEvent,
  handleQueryEvents,
} from "@/lib/handlers/calendar";
import {
  handleCreateBill,
  handleQueryBills,
  handleMarkBillPaid,
} from "@/lib/handlers/bills";
import {
  handleLogExpense,
  handleQuerySpending,
} from "@/lib/handlers/expenses";
import { buildDailySummary } from "@/lib/handlers/summary";

// ── LINE client setup ─────────────────────────────────────────────────────────

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
};

const lineClient = new line.messagingApi.MessagingApiClient(lineConfig);

// ── Webhook POST handler ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Read raw body for signature validation
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  // Validate LINE signature
  if (!line.validateSignature(rawBody, lineConfig.channelSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as line.WebhookRequestBody;

  // Process events — don't await in production to avoid timeout, but fine for MVP
  await Promise.all(body.events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

// ── Event router ──────────────────────────────────────────────────────────────

async function handleEvent(event: line.WebhookEvent) {
  // Only handle text messages for MVP
  if (event.type !== "message" || event.message.type !== "text") return;
  if (!event.source.userId) return;

  const lineUserId = event.source.userId;
  const text = event.message.text.trim();
  const replyToken = event.replyToken;

  try {
    // Get or create user
    const user = await getOrCreateUser(lineUserId);

    // Get Bangkok time string for AI context
    const nowBangkok = new Date().toLocaleString("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Parse intent with OpenAI
    const parsed = await parseMessage(text, nowBangkok);

    // Route to handler
    let replyText = "";

    switch (parsed.intent) {
      case "create_reminder":
        replyText = await handleReminder(user.id, parsed);
        break;

      case "create_event":
        replyText = await handleCreateEvent(user.id, parsed);
        break;

      case "query_events":
        replyText = await handleQueryEvents(user.id, parsed);
        break;

      case "create_bill":
        replyText = await handleCreateBill(user.id, parsed);
        break;

      case "query_bills":
        replyText = await handleQueryBills(user.id, parsed);
        break;

      case "mark_bill_paid":
        replyText = await handleMarkBillPaid(user.id, parsed);
        break;

      case "log_expense":
        replyText = await handleLogExpense(user.id, parsed, "expense");
        break;

      case "log_income":
        replyText = await handleLogExpense(user.id, parsed, "income");
        break;

      case "query_spending":
        replyText = await handleQuerySpending(user.id, parsed);
        break;

      case "query_summary":
        replyText = await buildDailySummary(user.id, parsed.language);
        break;

      default:
        replyText =
          parsed.language === "th"
            ? "ขอโทษนะ 🐾 ไม่เข้าใจที่พูด ลองพูดใหม่ได้เลย\nเช่น:\n• เตือนประชุม 10 โมงพรุ่งนี้\n• กาแฟ 120\n• เดือนนี้ใช้เงินเท่าไหร่"
            : "Sorry 🐾 I didn't understand that. Try:\n• Remind me about the meeting tomorrow at 10am\n• Coffee 120\n• How much did I spend this month?";
    }

    // Send reply
    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    });
  } catch (err) {
    console.error("Webhook error:", err);
    // Send a graceful error message so user isn't left hanging
    await lineClient
      .replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text: "มีปัญหาบางอย่างเกิดขึ้น 🐾 ลองใหม่อีกครั้งนะ",
          },
        ],
      })
      .catch(() => {}); // Swallow secondary errors
  }
}
