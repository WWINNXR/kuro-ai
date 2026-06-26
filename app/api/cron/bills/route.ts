import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { supabase } from "@/lib/supabase";

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function GET(req: NextRequest) {
  const headerSecret = req.headers.get("x-cron-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const secret = headerSecret ?? querySecret;

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const TZ = "Asia/Bangkok";
  const now = new Date();

  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });

  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysLaterStr = threeDaysLater.toLocaleDateString("en-CA", {
    timeZone: TZ,
  });

  const { data: bills, error } = await supabase
    .from("bills")
    .select("*")
    .eq("status", "unpaid")
    .gte("next_due_at", today)
    .lte("next_due_at", threeDaysLaterStr)
    .is("last_notified_at", null)
    .limit(50);

  if (error) {
    console.error(error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  if (!bills || bills.length === 0) {
    return NextResponse.json({
      success: true,
      sent: 0,
      message: "No bills to notify",
    });
  }

  let sent = 0;
  let failed = 0;

  for (const bill of bills) {
    try {
      const { data: user } = await supabase
        .from("users")
        .select("line_user_id, language")
        .eq("id", bill.user_id)
        .maybeSingle();

      if (!user?.line_user_id) {
        failed++;
        continue;
      }

      const amount = bill.amount
        ? `\n💰 จำนวน: ${Number(bill.amount).toLocaleString("th-TH")} บาท`
        : "";

      const dueText =
        bill.next_due_at === today
          ? "ครบกำหนดวันนี้"
          : `ครบกำหนด ${formatDate(bill.next_due_at)}`;

      const text =
        user.language === "en"
          ? `💳 Bill reminder

${bill.name}${amount}

Due: ${formatDate(bill.next_due_at)}`
          : `💳 แจ้งเตือนบิลครับ 🐾

${bill.name}${amount}

📅 ${dueText}`;

      await lineClient.pushMessage({
        to: user.line_user_id,
        messages: [{ type: "text", text }],
      });

      await supabase
        .from("bills")
        .update({
          last_notified_at: new Date().toISOString(),
        })
        .eq("id", bill.id);

      sent++;
    } catch (err) {
      console.error(err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    failed,
    checked: bills.length,
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}