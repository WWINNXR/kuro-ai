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

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
};

const lineClient = new line.messagingApi.MessagingApiClient(lineConfig);

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!line.validateSignature(rawBody, lineConfig.channelSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as line.WebhookRequestBody;

  await Promise.all(body.events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: line.WebhookEvent) {
  if (event.type !== "message" || event.message.type !== "text") return;
  if (!event.source.userId) return;

  const lineUserId = event.source.userId;
  const text = event.message.text.trim();
  const replyToken = event.replyToken;

  try {
    const user = await getOrCreateUser(lineUserId);

    const nowBangkok = new Date().toLocaleString("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parsed = await parseMessage(text, nowBangkok);

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
            ? `ขออภัยครับ 🐾

ผมยังไม่แน่ใจว่าคุณต้องการให้ช่วยเรื่องอะไร

ลองพิมพ์ตัวอย่างแบบนี้ได้เลย

📌 เตือนประชุมพรุ่งนี้ 10 โมง
💸 กาแฟ 120
📅 วันนี้มีนัดอะไรบ้าง
💳 เดือนนี้ต้องจ่ายอะไรบ้าง`
            : `Sorry 🐾

I'm not quite sure what you mean.

Try one of these:

📌 Remind me about the meeting tomorrow at 10am
💸 Coffee 120
📅 What do I have today?
💳 What bills are due this month?`;
    }

    await lineClient.replyMessage({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    });
  } catch (err) {
    console.error("Webhook error:", err);

    await lineClient
      .replyMessage({
        replyToken,
        messages: [
          {
            type: "text",
            text:
              "ขออภัยครับ 🐾\n\nเกิดข้อผิดพลาดระหว่างประมวลผล\n\nลองส่งข้อความอีกครั้งได้เลยครับ",
          },
        ],
      })
      .catch(() => {});
  }
}