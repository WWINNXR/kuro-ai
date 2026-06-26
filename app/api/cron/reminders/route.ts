import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";
import { supabase } from "@/lib/supabase";

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function GET(req: NextRequest) {
  // รองรับทั้ง Header และ Query
  const headerSecret = req.headers.get("x-cron-secret");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const secret = headerSecret ?? querySecret;

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      {
        success: false,
        error: "CRON_SECRET is missing",
      },
      {
        status: 500,
      }
    );
  }

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const now = new Date().toISOString();

  console.log("Reminder cron started:", now);

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("status", "active")
    .lte("remind_at", now)
    .limit(50);

  if (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error,
      },
      {
        status: 500,
      }
    );
  }

  if (!reminders || reminders.length === 0) {
    return NextResponse.json({
      success: true,
      fired: 0,
      failed: 0,
      message: "No reminders due",
    });
  }

  let fired = 0;
  let failed = 0;

  for (const reminder of reminders) {
    try {
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("line_user_id, language")
        .eq("id", reminder.user_id)
        .maybeSingle();

      if (userError) {
        console.error(userError);
        failed++;
        continue;
      }

      if (!user?.line_user_id) {
        console.log("LINE user not found:", reminder.user_id);
        failed++;
        continue;
      }

      const language = user.language ?? "th";

      const message =
        language === "th"
          ? `🔔 ถึงเวลาแล้วครับ 🐾

📌 ${reminder.subject}

เมื่อทำเสร็จแล้วสามารถพิมพ์

เสร็จแล้ว ${reminder.subject}

ได้เลยครับ`
          : `🔔 Reminder

${reminder.subject}

Reply:

done ${reminder.subject}

when finished.`;

      await lineClient.pushMessage({
        to: user.line_user_id,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      });

      if (reminder.rrule) {
        const nextDate = computeNextFromRRule(
          reminder.rrule,
          reminder.remind_at
        );

        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            remind_at: nextDate,
            fired_at: now,
          })
          .eq("id", reminder.id);

        if (updateError) {
          console.error(updateError);
        }
      } else {
        const { error: updateError } = await supabase
          .from("reminders")
          .update({
            status: "done",
            fired_at: now,
          })
          .eq("id", reminder.id);

        if (updateError) {
          console.error(updateError);
        }
      }

      fired++;
    } catch (err) {
      console.error(err);
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    fired,
    failed,
    checked: reminders.length,
    serverTime: now,
  });
}

function computeNextFromRRule(
  rrule: string,
  currentIso: string
): string {
  const next = new Date(currentIso);

  if (rrule.includes("FREQ=DAILY")) {
    next.setDate(next.getDate() + 1);
  } else if (rrule.includes("FREQ=WEEKLY")) {
    next.setDate(next.getDate() + 7);
  } else if (rrule.includes("FREQ=MONTHLY")) {
    next.setMonth(next.getMonth() + 1);
  } else if (rrule.includes("FREQ=YEARLY")) {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString();
}