import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

export async function handleReminder(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject || !parsed.datetime) {
    return parsed.language === "th"
      ? "ขอโทษนะ 🐾 ช่วยบอกด้วยว่าจะเตือนเรื่องอะไร และเมื่อไหร่?"
      : "Sorry 🐾 could you tell me what to remind you about and when?";
  }

  const remindAt = new Date(parsed.datetime);
  if (isNaN(remindAt.getTime())) {
    return parsed.language === "th"
      ? "ไม่เข้าใจเวลาที่ระบุ ลองใหม่อีกครั้งนะ เช่น 'เตือนประชุมพรุ่งนี้ 10 โมง'"
      : "I couldn't understand that time. Try again, e.g. 'remind me about the meeting tomorrow at 10am'";
  }

  const { error } = await supabase.from("reminders").insert({
    user_id: userId,
    subject: parsed.subject,
    remind_at: remindAt.toISOString(),
    rrule: parsed.rrule ?? null,
    status: "active",
  });

  if (error) throw error;

  // Format confirmation
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
      ? " (ทุกเดือน)"
      : " (monthly)"
    : "";

  return parsed.language === "th"
    ? `บันทึกแล้ว ✓\nจะเตือนเรื่อง: ${parsed.subject}\n${dateStr} เวลา ${timeStr}${recurring}`
    : `Saved ✓\nReminder: ${parsed.subject}\n${dateStr} at ${timeStr}${recurring}`;
}
