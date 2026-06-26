import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";
import { Reply } from "../replies";

// ── Log expense or income ─────────────────────────────────────────────────────

export async function handleLogExpense(
  userId: string,
  parsed: ParsedMessage,
  direction: "expense" | "income" = "expense"
): Promise<string> {
  if (!parsed.amount || parsed.amount <= 0) {
    return parsed.language === "th"
      ? "ขอจำนวนเงินเพิ่มนิดนึงครับ 🐾\nเช่น กาแฟ 120"
      : "Please include the amount, e.g. coffee 120";
  }

  const TZ = "Asia/Bangkok";
  const todayBangkok = new Date().toLocaleDateString("en-CA", {
    timeZone: TZ,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("en-CA", { timeZone: TZ });

  const description =
    parsed.subject ?? (direction === "income" ? "รายได้" : "รายจ่าย");

  const { error } = await supabase.from("expenses").insert({
    user_id: userId,
    description,
    amount: parsed.amount,
    direction,
    spent_at: todayBangkok,
  });

  if (error) throw error;

  const { data: todayData, error: todayError } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", direction)
    .eq("spent_at", todayBangkok);

  if (todayError) throw todayError;

  const todayTotal = (todayData ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  const { data: monthData, error: monthError } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", "expense")
    .gte("spent_at", monthStart)
    .lte("spent_at", todayBangkok);

  if (monthError) throw monthError;

  const monthExpenseTotal = (monthData ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("monthly_budget")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  const monthlyBudget = profile?.monthly_budget
    ? Number(profile.monthly_budget)
    : null;

  const remainingBudget =
    monthlyBudget !== null ? monthlyBudget - monthExpenseTotal : null;

  if (parsed.language === "th") {
    if (direction === "income") {
      return `รับทราบครับ 🐾

บันทึกรายรับเรียบร้อยแล้ว

💰 ${description}
${parsed.amount.toLocaleString("th-TH")} บาท

วันนี้มีรายรับรวม ${todayTotal.toLocaleString("th-TH")} บาท`;
    }

    let reply =
      Reply.expenseLogged(description, parsed.amount) +
      `

วันนี้ใช้จ่ายรวม ${todayTotal.toLocaleString("th-TH")} บาท
เดือนนี้ใช้ไป ${monthExpenseTotal.toLocaleString("th-TH")} บาท`;

    if (monthlyBudget !== null && remainingBudget !== null) {
      reply += `

งบเดือนนี้: ${monthlyBudget.toLocaleString("th-TH")} บาท
คงเหลือ: ${remainingBudget.toLocaleString("th-TH")} บาท`;

      if (remainingBudget < 0) {
        reply += `

⚠️ เดือนนี้ใช้เกินงบแล้วครับ`;
      } else if (remainingBudget <= monthlyBudget * 0.2) {
        reply += `

⚠️ งบคงเหลือน้อยกว่า 20% แล้วนะครับ`;
      }
    } else {
      reply += `

ถ้าต้องการให้ผมช่วยติดตามงบ ลองพิมพ์:
“งบเดือนละ 25000”`;
    }

    return reply;
  }

  let reply =
    direction === "income"
      ? `Saved 🐾

Income logged

💰 ${description}
${parsed.amount.toLocaleString("th-TH")} THB

Total income today: ${todayTotal.toLocaleString("th-TH")} THB`
      : `Saved 🐾

Expense logged

💸 ${description}
${parsed.amount.toLocaleString("th-TH")} THB

Total spending today: ${todayTotal.toLocaleString("th-TH")} THB
This month: ${monthExpenseTotal.toLocaleString("th-TH")} THB`;

  if (direction === "expense" && monthlyBudget !== null && remainingBudget !== null) {
    reply += `

Monthly budget: ${monthlyBudget.toLocaleString("th-TH")} THB
Remaining: ${remainingBudget.toLocaleString("th-TH")} THB`;
  }

  return reply;
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

  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("monthly_budget")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;

  const monthlyBudget = profile?.monthly_budget
    ? Number(profile.monthly_budget)
    : null;

  if (rows.length === 0) {
    return parsed.language === "th"
      ? `ยังไม่พบรายการ${label}ครับ 🐾`
      : `No records for ${label}`;
  }

  if (parsed.language === "th") {
    let reply = `📊 สรุปการเงิน${label}

💸 รายจ่าย: ${totalExpense.toLocaleString("th-TH")} บาท`;

    if (totalIncome > 0) {
      reply += `

💰 รายรับ: ${totalIncome.toLocaleString("th-TH")} บาท
🧾 คงเหลือ: ${(totalIncome - totalExpense).toLocaleString("th-TH")} บาท`;
    }

    if (period === "month" && monthlyBudget !== null) {
      const remainingBudget = monthlyBudget - totalExpense;

      reply += `

🎯 งบเดือนนี้: ${monthlyBudget.toLocaleString("th-TH")} บาท
📌 งบคงเหลือ: ${remainingBudget.toLocaleString("th-TH")} บาท`;

      if (remainingBudget < 0) {
        reply += `

⚠️ เดือนนี้ใช้เกินงบแล้วครับ`;
      } else if (remainingBudget <= monthlyBudget * 0.2) {
        reply += `

⚠️ งบคงเหลือน้อยกว่า 20% แล้วนะครับ`;
      }
    }

    return reply.trim();
  }

  let reply = `📊 Financial summary for ${label}

Expenses: ${totalExpense.toLocaleString("th-TH")} THB`;

  if (totalIncome > 0) {
    reply += `

Income: ${totalIncome.toLocaleString("th-TH")} THB
Balance: ${(totalIncome - totalExpense).toLocaleString("th-TH")} THB`;
  }

  return reply.trim();
}