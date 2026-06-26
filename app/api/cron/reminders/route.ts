import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { supabase } from "@/lib/supabase";

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

// Vercel Cron: runs every minute
// vercel.json: { "crons": [{ "path": "/api/cron/reminders", "schedule": "* * * * *" }] }
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Fetch all due reminders
  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*, users(line_user_id, language)")
    .eq("status", "active")
    .lte("remind_at", now)
    .limit(50); // Safety cap per run

  if (error) {
    console.error("Reminders fetch error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ fired: 0 });
  }

  let fired = 0;
  let failed = 0;

  for (const reminder of reminders) {
    const user = reminder.users as { line_user_id: string; language: string };
    if (!user?.line_user_id) continue;

    try {
      const lang = (user.language as "th" | "en") ?? "th";
      const msg =
        lang === "th"
          ? `🔔 เตือนความจำ\n${reminder.subject}\n\nจัดการแล้วพิมพ์ "เสร็จแล้ว ${reminder.subject}" ได้เลยนะ`
          : `🔔 Reminder\n${reminder.subject}\n\nReply "done ${reminder.subject}" when finished`;

      await lineClient.pushMessage({
        to: user.line_user_id,
        messages: [{ type: "text", text: msg }],
      });

      // Update: mark fired and compute next for recurring
      if (reminder.rrule) {
        // Simple monthly recurrence: advance by ~30 days
        const nextRemindAt = computeNextFromRRule(
          reminder.rrule,
          reminder.remind_at
        );
        await supabase
          .from("reminders")
          .update({ fired_at: now, remind_at: nextRemindAt })
          .eq("id", reminder.id);
      } else {
        await supabase
          .from("reminders")
          .update({ status: "done", fired_at: now })
          .eq("id", reminder.id);
      }

      fired++;
    } catch (err) {
      console.error(`Failed to fire reminder ${reminder.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ fired, failed });
}

// ── Simple RRULE → next date ──────────────────────────────────────────────────
// Handles FREQ=MONTHLY;BYMONTHDAY=N and FREQ=WEEKLY;BYDAY=SU,MO etc.
// For full RRULE support, add the `rrule` npm package in v2.

function computeNextFromRRule(rrule: string, currentIso: string): string {
  const current = new Date(currentIso);

  if (rrule.includes("FREQ=MONTHLY")) {
    current.setMonth(current.getMonth() + 1);
  } else if (rrule.includes("FREQ=WEEKLY")) {
    current.setDate(current.getDate() + 7);
  } else if (rrule.includes("FREQ=DAILY")) {
    current.setDate(current.getDate() + 1);
  } else {
    // Fallback: 30 days
    current.setDate(current.getDate() + 30);
  }

  return current.toISOString();
}
