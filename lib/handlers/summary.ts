import { supabase } from "../supabase";

// ── Build summary text ────────────────────────────────────────────────────────
// Called both for on-demand queries and by the CRON job

export async function buildDailySummary(
  userId: string,
  language: "th" | "en" = "th"
): Promise<string> {
  const TZ = "Asia/Bangkok";
  const now = new Date();

  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const todayStart = `${todayStr}T00:00:00+07:00`;
  const todayEnd = `${todayStr}T23:59:59+07:00`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString("en-CA", { timeZone: TZ });

  // Fetch today's events
  const { data: events } = await supabase
    .from("events")
    .select("title, start_at")
    .eq("user_id", userId)
    .gte("start_at", todayStart)
    .lte("start_at", todayEnd)
    .order("start_at")
    .limit(5);

  // Fetch bills due today or in 3 days
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysStr = threeDaysLater.toLocaleDateString("en-CA", { timeZone: TZ });

  const { data: bills } = await supabase
    .from("bills")
    .select("name, amount, next_due_at")
    .eq("user_id", userId)
    .eq("status", "unpaid")
    .gte("next_due_at", todayStr)
    .lte("next_due_at", threeDaysStr)
    .order("next_due_at")
    .limit(5);

  // Fetch yesterday's expense total
  const { data: yesterdayExpenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", "expense")
    .eq("spent_at", yesterdayStr);

  const yesterdayTotal = (yesterdayExpenses ?? []).reduce(
    (sum, r) => sum + Number(r.amount),
    0
  );

  // ── Compose message ─────────────────────────────────────────────────────────

  const hasContent =
    (events && events.length > 0) ||
    (bills && bills.length > 0) ||
    yesterdayTotal > 0;

  if (!hasContent) {
    return language === "th"
      ? `สวัสดีตอนเช้า 🐾\nวันนี้ยังไม่มีนัดหมายหรือบิลที่ต้องจ่าย\nมีอะไรให้ช่วยบอก Kuro ได้เลยนะ 🖤`
      : `Good morning 🐾\nNo events or bills due today.\nJust chat if you need anything 🖤`;
  }

  const lines: string[] = [];

  if (language === "th") {
    lines.push("สวัสดีตอนเช้า 🐾 วันนี้ของคุณ:");
  } else {
    lines.push("Good morning 🐾 Here's your day:");
  }

  // Events section
  if (events && events.length > 0) {
    lines.push("");
    lines.push(language === "th" ? "📅 นัดหมาย" : "📅 Appointments");
    for (const e of events) {
      const t = new Date(e.start_at).toLocaleTimeString("th-TH", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
      });
      lines.push(`  • ${t} — ${e.title}`);
    }
  }

  // Bills section
  if (bills && bills.length > 0) {
    lines.push("");
    lines.push(language === "th" ? "💸 บิลที่ใกล้ครบกำหนด" : "💸 Bills due soon");
    for (const b of bills) {
      const dueStr = b.next_due_at === todayStr
        ? language === "th" ? "วันนี้!" : "Today!"
        : language === "th"
        ? `${formatDateShort(b.next_due_at)}`
        : formatDateShort(b.next_due_at);
      const amtStr = b.amount
        ? ` ${Number(b.amount).toLocaleString("th-TH")} บาท`
        : "";
      lines.push(`  • ${b.name}${amtStr} — ${dueStr}`);
    }
  }

  // Yesterday spend
  if (yesterdayTotal > 0) {
    lines.push("");
    lines.push(
      language === "th"
        ? `📊 รายจ่ายเมื่อวาน: ${yesterdayTotal.toLocaleString("th-TH")} บาท`
        : `📊 Yesterday's spending: ${yesterdayTotal.toLocaleString("th-TH")} THB`
    );
  }

  lines.push("");
  lines.push(
    language === "th"
      ? "มีอะไรเพิ่มเติมบอก Kuro ได้เลยนะ 🖤"
      : "Just chat if you need anything 🖤"
  );

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
  });
}
