import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

// ── Create event ─────────────────────────────────────────────────────────────

export async function handleCreateEvent(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject || !parsed.datetime) {
    return parsed.language === "th"
      ? "ช่วยบอกชื่อนัดและเวลาด้วยนะ เช่น 'เพิ่มนัดประชุมพรุ่งนี้ 10 โมง'"
      : "Please include the event name and time, e.g. 'add meeting tomorrow at 10am'";
  }

  const startAt = new Date(parsed.datetime);
  if (isNaN(startAt.getTime())) {
    return parsed.language === "th"
      ? "ไม่เข้าใจเวลาที่ระบุ ลองอีกครั้งนะ"
      : "I couldn't understand that time. Please try again.";
  }

  const { error } = await supabase.from("events").insert({
    user_id: userId,
    title: parsed.subject,
    start_at: startAt.toISOString(),
  });

  if (error) throw error;

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

  return parsed.language === "th"
    ? `บันทึกนัดแล้ว ✓\n📅 ${parsed.subject}\n${dateStr} เวลา ${timeStr}`
    : `Event saved ✓\n📅 ${parsed.subject}\n${dateStr} at ${timeStr}`;
}

// ── Query events ─────────────────────────────────────────────────────────────

export async function handleQueryEvents(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const now = new Date();
  const TZ = "Asia/Bangkok";

  // Determine range based on period
  let rangeStart: Date;
  let rangeEnd: Date;
  let label: string;

  const period = parsed.period ?? "today";

  if (period === "week") {
    rangeStart = startOfDayBangkok(now);
    rangeEnd = new Date(rangeStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    label = parsed.language === "th" ? "7 วันข้างหน้า" : "next 7 days";
  } else {
    // Default: today
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
      ? `ไม่มีนัดหมาย${label}เลย 🐾`
      : `No events ${label} 🐾`;
  }

  const lines = data.map((e) => {
    const t = new Date(e.start_at).toLocaleTimeString("th-TH", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
    });
    return `• ${t} — ${e.title}`;
  });

  const header =
    parsed.language === "th"
      ? `📅 นัดหมาย${label} (${data.length} รายการ)\n`
      : `📅 Events ${label} (${data.length} items)\n`;

  return header + lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDayBangkok(date: Date): Date {
  const d = new Date(
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T00:00:00+07:00"
  );
  return d;
}

function endOfDayBangkok(date: Date): Date {
  const d = new Date(
    date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }) + "T23:59:59+07:00"
  );
  return d;
}
