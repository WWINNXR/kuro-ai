import type { KuroContext } from "./context";

export function generateFinancialInsight(context: KuroContext): string {
  const budget = context.profile?.monthly_budget;

  if (!budget) {
    return "";
  }

  const monthlyBudget = Number(budget);
  const spent = context.monthExpense;
  const remaining = monthlyBudget - spent;
  const usedPercent = Math.round((spent / monthlyBudget) * 100);

  if (spent <= 0) {
    return `📈 เดือนนี้ยังไม่มีรายจ่ายที่บันทึกไว้ครับ`;
  }

  if (remaining < 0) {
    return `⚠️ เดือนนี้ใช้เกินงบแล้ว ${Math.abs(remaining).toLocaleString(
      "th-TH"
    )} บาทครับ`;
  }

  if (usedPercent >= 90) {
    return `⚠️ ใช้งบไปแล้ว ${usedPercent}%\nควรระวังรายจ่ายช่วงที่เหลือของเดือนครับ`;
  }

  if (usedPercent >= 70) {
    return `📌 ใช้งบไปแล้ว ${usedPercent}%\nยังอยู่ในระดับที่ควรเริ่มระวังครับ`;
  }

  if (usedPercent <= 30) {
    return `📈 ใช้งบไปเพียง ${usedPercent}% ของงบเดือนนี้\nตอนนี้ยังควบคุมรายจ่ายได้ดีครับ`;
  }

  return `📊 ใช้งบไปแล้ว ${usedPercent}%\nงบคงเหลือ ${remaining.toLocaleString(
    "th-TH"
  )} บาทครับ`;
}

export function generateBillsInsight(context: KuroContext): string {
  if (context.unpaidBillsCount <= 0) {
    return "";
  }

  const total = context.unpaidBillsTotal;

  if (total > 0) {
    return `💳 มีบิลใกล้ครบกำหนด ${context.unpaidBillsCount} รายการ\nรวมประมาณ ${total.toLocaleString(
      "th-TH"
    )} บาท`;
  }

  return `💳 มีบิลใกล้ครบกำหนด ${context.unpaidBillsCount} รายการครับ`;
}