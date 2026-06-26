import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

// ── Create bill ───────────────────────────────────────────────────────────────

export async function handleCreateBill(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject) {
    return parsed.language === "th"
      ? "ช่วยบอกชื่อบิลด้วยนะ เช่น 'ค่าไฟครบกำหนดวันที่ 25'"
      : "Please include the bill name, e.g. 'electricity bill due on the 25th'";
  }

  const recurrence = parsed.recurrence ?? "once";
  let nextDueAt: string;

  if (parsed.due_date) {
    nextDueAt = parsed.due_date;
  } else if (parsed.due_day) {
    nextDueAt = nextOccurrenceOfDay(parsed.due_day);
  } else {
    return parsed.language === "th"
      ? "ครบกำหนดวันไหนนะ? เช่น 'ค่าไฟวันที่ 25'"
      : "When is it due? e.g. 'electricity on the 25th'";
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
    ? ` ${parsed.amount.toLocaleString("th-TH")} บาท`
    : "";
  const recurrenceStr =
    recurrence === "monthly"
      ? parsed.language === "th"
        ? " (ทุกเดือน)"
        : " (monthly)"
      : "";

  return parsed.language === "th"
    ? `บันทึกบิลแล้ว ✓\n💸 ${parsed.subject}${amountStr}\nครบกำหนด: ${formatDate(nextDueAt)}${recurrenceStr}`
    : `Bill saved ✓\n💸 ${parsed.subject}${amountStr}\nDue: ${formatDate(nextDueAt)}${recurrenceStr}`;
}

// ── Query bills ───────────────────────────────────────────────────────────────

export async function handleQueryBills(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  // Get this month's bills
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

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
      ? "ไม่มีบิลเดือนนี้เลย 🐾"
      : "No bills this month 🐾";
  }

  const lines = data.map((b) => {
    const status = b.status === "paid" ? "✓" : "⏳";
    const amount = b.amount ? ` ${b.amount.toLocaleString("th-TH")} บาท` : "";
    return `${status} ${b.name}${amount} — ${formatDate(b.next_due_at)}`;
  });

  const unpaidTotal = data
    .filter((b) => b.status !== "paid" && b.amount)
    .reduce((sum, b) => sum + Number(b.amount), 0);

  const header =
    parsed.language === "th"
      ? `📋 บิลเดือนนี้\n\n`
      : `📋 This month's bills\n\n`;
  const footer =
    unpaidTotal > 0
      ? parsed.language === "th"
        ? `\nรวมที่ยังไม่ได้จ่าย: ${unpaidTotal.toLocaleString("th-TH")} บาท`
        : `\nTotal unpaid: ${unpaidTotal.toLocaleString("th-TH")} THB`
      : "";

  return header + lines.join("\n") + footer;
}

// ── Mark bill paid ────────────────────────────────────────────────────────────

export async function handleMarkBillPaid(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.subject) {
    return parsed.language === "th"
      ? "จ่ายบิลอะไรไปแล้ว? บอกชื่อบิลด้วยนะ"
      : "Which bill did you pay? Please include the bill name.";
  }

  // Find the most recent unpaid bill matching the subject
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
      ? `ไม่พบบิล "${parsed.subject}" ที่ยังค้างอยู่`
      : `No unpaid bill found matching "${parsed.subject}"`;
  }

  const bill = data[0];
  const updates: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };

  // If monthly recurring, advance next_due_at by one month
  if (bill.recurrence === "monthly" && bill.due_day) {
    updates.status = "unpaid";
    updates.paid_at = null;
    updates.next_due_at = nextOccurrenceOfDay(bill.due_day, true);

    // Also mark this occurrence as paid in a separate log (simplified: just advance)
    await supabase
      .from("bills")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", bill.id);

    // Insert next cycle
    await supabase.from("bills").insert({
      user_id: userId,
      name: bill.name,
      amount: bill.amount,
      due_day: bill.due_day,
      next_due_at: nextOccurrenceOfDay(bill.due_day, true),
      recurrence: "monthly",
      status: "unpaid",
    });

    return parsed.language === "th"
      ? `✓ บันทึกการจ่าย ${bill.name} แล้ว\nรอบถัดไปวันที่ ${nextOccurrenceOfDay(bill.due_day, true)}`
      : `✓ Marked ${bill.name} as paid\nNext due: ${nextOccurrenceOfDay(bill.due_day, true)}`;
  }

  await supabase.from("bills").update(updates).eq("id", bill.id);

  return parsed.language === "th"
    ? `✓ จ่าย ${bill.name} แล้ว`
    : `✓ Marked ${bill.name} as paid`;
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
