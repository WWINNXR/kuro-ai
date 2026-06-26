import type { KuroContext } from "./context";

export function generateReasoningNote(context: KuroContext): string {
  const notes: string[] = [];

  const budget = context.profile?.monthly_budget
    ? Number(context.profile.monthly_budget)
    : null;

  if (budget && budget > 0) {
    const usedPercent = Math.round((context.monthExpense / budget) * 100);

    if (usedPercent >= 100) {
      notes.push(
        `⚠️ เดือนนี้ใช้เกินงบแล้วครับ ควรชะลอรายจ่ายที่ไม่จำเป็นก่อน`
      );
    } else if (usedPercent >= 80) {
      notes.push(
        `⚠️ ใช้งบไปแล้ว ${usedPercent}% แล้วครับ ช่วงที่เหลือของเดือนควรระวังเป็นพิเศษ`
      );
    } else if (usedPercent >= 60) {
      notes.push(
        `📌 ใช้งบไปแล้ว ${usedPercent}% ยังพอควบคุมได้ แต่ควรเริ่มระวังรายจ่ายย่อย ๆ`
      );
    } else if (usedPercent <= 30 && context.monthExpense > 0) {
      notes.push(
        `📈 ตอนนี้ใช้ไปเพียง ${usedPercent}% ของงบเดือนนี้ ถือว่าคุมรายจ่ายได้ดีครับ`
      );
    }
  }

  if (context.unpaidBillsCount > 0) {
    notes.push(
      `💳 มีบิลใกล้ครบกำหนด ${context.unpaidBillsCount} รายการ ควรเผื่องบไว้ก่อนใช้จ่ายเพิ่ม`
    );
  }

  if (context.todayEvents.length >= 3) {
    notes.push(
      `📅 วันนี้มีนัดหลายรายการ ลองเผื่อเวลาพักระหว่างวันไว้ด้วยนะครับ`
    );
  }

  if (notes.length === 0) {
    return "";
  }

  return notes.join("\n\n");
}