import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { getOrCreateUser } from "@/lib/supabase";
import { parseMessage } from "@/lib/openai";
import { getActiveTask } from "@/lib/task-manager";
import { handleConversationTask } from "@/lib/handlers/conversation";
import { routeIntent } from "@/lib/router";
import { buildContext } from "@/lib/context";

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

    const activeTask = await getActiveTask(user.id);

    if (activeTask) {
      const conversationReply = await handleConversationTask(user.id, parsed);

      if (conversationReply) {
        await lineClient.replyMessage({
          replyToken,
          messages: [{ type: "text", text: conversationReply }],
        });

        return;
      }
    }

    const context = await buildContext(user.id);
    const replyText = await routeIntent(user.id, parsed, context);

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