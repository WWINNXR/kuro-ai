import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

// ── Create bill ───────────────────────────────────────────────────────────────

export async function handleCreateBill(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject) {
    return parsed.language === "th"
      ? "ขอชื่อบิลเพิ่มนิดนึงครับ 🐾\nเช่น ค่าไฟครบกำหนดวันที่ 25"
      : "Please include the bill name, e.g. electricity bill due on the 25th";
  }

  const recurrence = parsed.recurrence ?? "once";
  let nextDueAt: string;

  if (parsed.due_date) {
    nextDueAt = parsed.due_date;
  } else if (parsed.due_day) {
    nextDueAt = nextOccurrenceOfDay(parsed.due_day);
  } else {
    return parsed.language === "th"
      ? "บิลนี้ครบกำหนดวันไหนครับ?\nเช่น ค่าไฟวันที่ 25"
      : "When is it due? e.g. electricity on the 25th";
  }

  const { error } = await supabase.from("bills").insert({
    user_id: userId,
    name: parsed.subject,
    amount: parsed.amount ?? null,
    next_due_at: nextDueAt,
    due_day: parsed.due_day ?? null,
    recurrence,
    status: "unpaid",
  });

  if (error) throw error;

  const amountStr = parsed.amount
    ? `\n💰 จำนวน: ${parsed.amount.toLocaleString("th-TH")} บาท`
    : "";

  const recurrenceStr =
    recurrence === "monthly"
      ? parsed.language === "th"
        ? "\n🔁 เตือนซ้ำทุกเดือน"
        : "\n🔁 Monthly recurring"
      : "";

  return parsed.language === "th"
    ? `รับทราบครับ 🐾

ผมบันทึกบิลเรียบร้อยแล้ว

💳 บิล: ${parsed.subject}${amountStr}
📅 ครบกำหนด: ${formatDate(nextDueAt)}${recurrenceStr}`
    : `Saved 🐾

Bill created

💳 Bill: ${parsed.subject}${amountStr}
📅 Due: ${formatDate(nextDueAt)}${recurrenceStr}`;
}

// ── Query bills ───────────────────────────────────────────────────────────────

export async function handleQueryBills(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const now = new Date();
  const todayStr = toDateOnly(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysLaterStr = toDateOnly(sevenDaysLater);

  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .gte("next_due_at", monthStart)
    .lte("next_due_at", monthEnd)
    .order("next_due_at");

  if (error) throw error;

  if (!data || data.length === 0) {
    return parsed.language === "th"
      ? "เดือนนี้ยังไม่พบบิลที่ต้องจ่ายครับ 🐾"
      : "No bills found this month 🐾";
  }

  const unpaidBills = data.filter((b) => b.status !== "paid");
  const dueSoonBills = unpaidBills.filter(
    (b) => b.next_due_at >= todayStr && b.next_due_at <= sevenDaysLaterStr
  );

  const unpaidTotal = unpaidBills
    .filter((b) => b.amount)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const lines = data.map((b) => {
    const status = b.status === "paid" ? "✅ จ่ายแล้ว" : "⏳ ยังไม่จ่าย";
    const amount = b.amount ? ` — ${b.amount.toLocaleString("th-TH")} บาท` : "";
    const dueNote = getDueNote(b.next_due_at, parsed.language);
    return `${status}
💳 ${b.name}${amount}
📅 ${formatDate(b.next_due_at)}${dueNote ? ` (${dueNote})` : ""}`;
  });

  if (parsed.language === "th") {
    let reply = `📋 บิลเดือนนี้

ทั้งหมด ${data.length} รายการ
ค้างชำระ ${unpaidBills.length} รายการ`;

    if (unpaidTotal > 0) {
      reply += `
รวมยอดค้างชำระ ${unpaidTotal.toLocaleString("th-TH")} บาท`;
    }

    if (dueSoonBills.length > 0) {
      reply += `

⚠️ ใกล้ครบกำหนดใน 7 วัน: ${dueSoonBills.length} รายการ`;
    }

    reply += `

${lines.join("\n\n")}`;

    return reply;
  }

  let reply = `📋 This month's bills

Total: ${data.length}
Unpaid: ${unpaidBills.length}`;

  if (unpaidTotal > 0) {
    reply += `
Total unpaid: ${unpaidTotal.toLocaleString("th-TH")} THB`;
  }

  if (dueSoonBills.length > 0) {
    reply += `

⚠️ Due within 7 days: ${dueSoonBills.length}`;
  }

  reply += `

${lines.join("\n\n")}`;

  return reply;
}

// ── Mark bill paid ────────────────────────────────────────────────────────────

export async function handleMarkBillPaid(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject) {
    return parsed.language === "th"
      ? "จ่ายบิลอะไรไปแล้วครับ?\nบอกชื่อบิลให้ผมหน่อย 🐾"
      : "Which bill did you pay? Please include the bill name.";
  }

  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "unpaid")
    .ilike("name", `%${parsed.subject}%`)
    .order("next_due_at")
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) {
    return parsed.language === "th"
      ? `ยังไม่พบบิล "${parsed.subject}" ที่ค้างอยู่ครับ`
      : `No unpaid bill found matching "${parsed.subject}"`;
  }

  const bill = data[0];

  const updates: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };

  if (bill.recurrence === "monthly" && bill.due_day) {
    await supabase
      .from("bills")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", bill.id);

    const nextDue = nextOccurrenceOfDay(bill.due_day, true);

    await supabase.from("bills").insert({
      user_id: userId,
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
      next_due_at: nextDue,
      recurrence: "monthly",
      status: "unpaid",
    });

    return parsed.language === "th"
      ? `เรียบร้อยครับ 🐾

บันทึกว่า “${bill.name}” จ่ายแล้ว

📅 รอบถัดไป: ${formatDate(nextDue)}`
      : `Done 🐾

Marked "${bill.name}" as paid

📅 Next due: ${formatDate(nextDue)}`;
  }

  await supabase.from("bills").update(updates).eq("id", bill.id);

  return parsed.language === "th"
    ? `เรียบร้อยครับ 🐾\nบันทึกว่า “${bill.name}” จ่ายแล้ว`
    : `Done 🐾\nMarked "${bill.name}" as paid`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextOccurrenceOfDay(day: number, skipThisMonth = false): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  let candidate = new Date(year, month, day);

  if (skipThisMonth || candidate <= now) {
    candidate = new Date(year, month + 1, day);
  }

  return candidate.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDueNote(dateStr: string, language: "th" | "en"): string {
  const today = new Date(toDateOnly(new Date()));
  const due = new Date(dateStr);
  const diffDays = Math.ceil(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return language === "th" ? "ครบกำหนดวันนี้" : "due today";
  if (diffDays === 1) return language === "th" ? "พรุ่งนี้" : "tomorrow";
  if (diffDays > 1 && diffDays <= 7)
    return language === "th" ? `อีก ${diffDays} วัน` : `in ${diffDays} days`;
  if (diffDays < 0)
    return language === "th"
      ? `เกินกำหนด ${Math.abs(diffDays)} วัน`
      : `${Math.abs(diffDays)} days overdue`;

  return "";
}