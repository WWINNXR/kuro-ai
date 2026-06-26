import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { supabase } from "@/lib/supabase";
import { buildDailySummary } from "@/lib/handlers/summary";

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

// Vercel Cron calls this at 00:00 UTC = 07:00 Bangkok
// Configure in vercel.json
export async function GET(req: NextRequest) {
  // Protect endpoint — only callable with secret header
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const TZ = "Asia/Bangkok";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  // Get all users who haven't received a briefing today
  const { data: users, error } = await supabase
    .from("users")
    .select("id, line_user_id, language")
    .not(
      "id",
      "in",
      `(SELECT user_id FROM briefing_log WHERE sent_date = '${todayStr}')`
    );

  if (error) {
    console.error("Briefing fetch error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const summary = await buildDailySummary(
        user.id,
        (user.language as "th" | "en") ?? "th"
      );

      await lineClient.pushMessage({
        to: user.line_user_id,
        messages: [{ type: "text", text: summary }],
      });

      // Log successful send
      await supabase
        .from("briefing_log")
        .upsert({ user_id: user.id, sent_date: todayStr });

      sent++;
    } catch (err) {
      console.error(`Failed to send briefing to ${user.line_user_id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ sent, failed });
}
