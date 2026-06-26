import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";
import { KURO_PERSONALITY } from "../personality";

export async function handleReminder(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject || !parsed.datetime) {
    return parsed.language === "th"
      ? "ขอรายละเอียดเพิ่มนิดนึงครับ 🐾\nอยากให้เตือนเรื่องอะไร และเวลาไหน?"
      : "Could you tell me what to remind you about and when?";
  }

  const remindAt = new Date(parsed.datetime);
  if (isNaN(remindAt.getTime())) {
    return parsed.language === "th"
      ? "ผมยังอ่านเวลาไม่ออกครับ 🐾\nลองพิมพ์แบบนี้: เตือนประชุมพรุ่งนี้ 10 โมง"
      : "I couldn't understand the time. Try: remind me about the meeting tomorrow at 10am";
  }

  const { error } = await supabase.from("reminders").insert({
    user_id: userId,
    subject: parsed.subject,
    remind_at: remindAt.toISOString(),
    rrule: parsed.rrule ?? null,
    status: "active",
  });

  if (error) throw error;

  const dateStr = remindAt.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const timeStr = remindAt.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });

  const recurring = parsed.rrule
    ? parsed.language === "th"
      ? "\n🔁 เตือนซ้ำตามรอบที่กำหนด"
      : "\n🔁 Recurring reminder enabled"
    : "";

  return parsed.language === "th"
    ? `${KURO_PERSONALITY.confirm[0]}

ผมบันทึกการเตือนเรียบร้อยแล้ว

📌 เรื่อง: ${parsed.subject}
🕒 เวลา: ${dateStr} ${timeStr}${recurring}`
    : `Saved 🐾

Reminder created

📌 Subject: ${parsed.subject}
🕒 Time: ${dateStr} ${timeStr}${recurring}`;
}