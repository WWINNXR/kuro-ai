import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

// ── Log expense or income ─────────────────────────────────────────────────────

export async function handleLogExpense(
  userId: string,
  parsed: ParsedMessage,
  direction: "expense" | "income" = "expense"
): Promise<string> {
  if (!parsed.amount || parsed.amount <= 0) {
    return parsed.language === "th"
      ? "ช่วยบอกจำนวนเงินด้วยนะ เช่น 'กาแฟ 120'"
      : "Please include the amount, e.g. 'coffee 120'";
  }

  const todayBangkok = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });

  const { error } = await supabase.from("expenses").insert({
    user_id: userId,
    description: parsed.subject ?? (direction === "income" ? "รายได้" : "รายจ่าย"),
    amount: parsed.amount,
    direction,
    spent_at: todayBangkok,
  });

  if (error) throw error;

  // Get today's total for this direction
  const { data: todayData } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", direction)
    .eq("spent_at", todayBangkok);

  const todayTotal = (todayData ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  const emoji = direction === "income" ? "💰" : "💸";
  const label =
    direction === "income"
      ? parsed.language === "th"
        ? "รายได้"
        : "income"
      : parsed.language === "th"
      ? "รายจ่าย"
      : "expense";

  const todayLabel =
    parsed.language === "th"
      ? `${label}วันนี้รวม: ${todayTotal.toLocaleString("th-TH")} บาท`
      : `Total ${label} today: ${todayTotal.toLocaleString("th-TH")} THB`;

  const desc = parsed.subject ?? "";

  return parsed.language === "th"
    ? `${emoji} บันทึกแล้ว\n${desc} ${parsed.amount.toLocaleString("th-TH")} บาท\n${todayLabel}`
    : `${emoji} Saved\n${desc} ${parsed.amount.toLocaleString("th-TH")} THB\n${todayLabel}`;
}

// ── Query spending ────────────────────────────────────────────────────────────

export async function handleQuerySpending(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const TZ = "Asia/Bangkok";
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });

  let startDate: string;
  let label: string;

  const period = parsed.period ?? "month";

  if (period === "today") {
    startDate = todayStr;
    label = parsed.language === "th" ? "วันนี้" : "today";
  } else if (period === "yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = yesterday.toLocaleDateString("en-CA", { timeZone: TZ });
    label = parsed.language === "th" ? "เมื่อวาน" : "yesterday";
  } else if (period === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    startDate = weekAgo.toLocaleDateString("en-CA", { timeZone: TZ });
    label = parsed.language === "th" ? "7 วันที่ผ่านมา" : "last 7 days";
  } else {
    // month
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      .toLocaleDateString("en-CA", { timeZone: TZ });
    label = parsed.language === "th" ? "เดือนนี้" : "this month";
  }

  const { data, error } = await supabase
    .from("expenses")
    .select("amount, direction, description")
    .eq("user_id", userId)
    .gte("spent_at", startDate)
    .lte("spent_at", todayStr);

  if (error) throw error;

  const rows = data ?? [];
  const totalExpense = rows
    .filter((r) => r.direction === "expense")
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const totalIncome = rows
    .filter((r) => r.direction === "income")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  if (rows.length === 0) {
    return parsed.language === "th"
      ? `ยังไม่มีรายการ${label}เลย`
      : `No records for ${label}`;
  }

  if (parsed.language === "th") {
    let reply = `📊 สรุป${label}\n`;
    reply += `รายจ่าย: ${totalExpense.toLocaleString("th-TH")} บาท\n`;
    if (totalIncome > 0)
      reply += `รายได้: ${totalIncome.toLocaleString("th-TH")} บาท\n`;
    if (totalIncome > 0)
      reply += `คงเหลือ: ${(totalIncome - totalExpense).toLocaleString("th-TH")} บาท`;
    return reply.trim();
  } else {
    let reply = `📊 Summary for ${label}\n`;
    reply += `Expenses: ${totalExpense.toLocaleString("th-TH")} THB\n`;
    if (totalIncome > 0)
      reply += `Income: ${totalIncome.toLocaleString("th-TH")} THB\n`;
    if (totalIncome > 0)
      reply += `Balance: ${(totalIncome - totalExpense).toLocaleString("th-TH")} THB`;
    return reply.trim();
  }
}
