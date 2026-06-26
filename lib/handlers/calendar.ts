import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";
import { createGoogleCalendarEvent } from "../google-calendar";

// ── Create event ─────────────────────────────────────────────────────────────

export async function handleCreateEvent(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject || !parsed.datetime) {
    return parsed.language === "th"
      ? "ขอรายละเอียดนัดเพิ่มนิดนึงครับ 🐾\nอยากเพิ่มนัดอะไร และเวลาไหน?"
      : "Please include the event name and time, e.g. add meeting tomorrow at 10am";
  }

  const startAt = new Date(parsed.datetime);

  if (isNaN(startAt.getTime())) {
    return parsed.language === "th"
      ? "ผมยังอ่านเวลาไม่ออกครับ 🐾\nลองพิมพ์แบบนี้: เพิ่มนัดประชุมพรุ่งนี้ 10 โมง"
      : "I couldn't understand the time. Try: add meeting tomorrow at 10am";
  }

  const { error } = await supabase.from("events").insert({
    user_id: userId,
    title: parsed.subject,
    start_at: startAt.toISOString(),
  });

  if (error) throw error;

  const shouldAddMeet =
    parsed.subject.toLowerCase().includes("meet") ||
    parsed.subject.toLowerCase().includes("google meet") ||
    parsed.subject.includes("มีต") ||
    parsed.subject.includes("ประชุม");

  const googleEvent = await createGoogleCalendarEvent({
    userId,
    title: parsed.subject,
    startAt,
    addMeet: shouldAddMeet,
  });

  const dateStr = startAt.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const timeStr = startAt.toLocaleTimeString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  });

  const googleText = googleEvent
    ? `

🌐 Google Calendar: เชื่อมแล้ว${
        googleEvent.meetLink ? `\n🔗 Google Meet: ${googleEvent.meetLink}` : ""
      }`
    : "";

  return parsed.language === "th"
    ? `รับทราบครับ 🐾

ผมบันทึกนัดหมายเรียบร้อยแล้ว

📅 นัด: ${parsed.subject}
🕒 เวลา: ${dateStr} ${timeStr}${googleText}`
    : `Saved 🐾

Event created

📅 Event: ${parsed.subject}
🕒 Time: ${dateStr} ${timeStr}${
        googleEvent?.meetLink ? `\n🔗 Google Meet: ${googleEvent.meetLink}` : ""
      }`;
}

// ── Query events ─────────────────────────────────────────────────────────────

export async function handleQueryEvents(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const now = new Date();
  const TZ = "Asia/Bangkok";

  let rangeStart: Date;
  let rangeEnd: Date;
  let label: string;

  const period = parsed.period ?? "today";

  if (period === "week") {
    rangeStart = startOfDayBangkok(now);
    rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    label = parsed.language === "th" ? "7 วันข้างหน้า" : "next 7 days";
  } else {
    rangeStart = startOfDayBangkok(now);
    rangeEnd = endOfDayBangkok(now);
    label = parsed.language === "th" ? "วันนี้" : "today";
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", rangeStart.toISOString())
    .lte("start_at", rangeEnd.toISOString())
    .order("start_at");

  if (error) throw error;

  if (!data || data.length === 0) {
    return parsed.language === "th"
      ? `ยังไม่มีนัดหมาย${label}ครับ 🐾`
      : `No events ${label} 🐾`;
  }

  const lines = data.map((e) => {
    const t = new Date(e.start_at).toLocaleTimeString("th-TH", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
    });

    return `🕒 ${t} — ${e.title}`;
  });

  const header =
    parsed.language === "th"
      ? `📅 นัดหมาย${label}

วันนี้คุณมี ${data.length} รายการ

`
      : `📅 Events ${label}

You have ${data.length} item(s)

`;

  return header + lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDayBangkok(date: Date): Date {
  return new Date(
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) +
      "T00:00:00+07:00"
  );
}

function endOfDayBangkok(date: Date): Date {
  return new Date(
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) +
      "T23:59:59+07:00"
  );
}