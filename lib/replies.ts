export const Reply = {
  reminderCreated(subject: string, date: string) {
    return `รับทราบครับ 🐾

ผมบันทึกการเตือนเรียบร้อยแล้ว

📌 เรื่อง: ${subject}
🕒 เวลา: ${date}`;
  },

  expenseLogged(item: string, amount: number) {
    return `รับทราบครับ 🐾

บันทึกรายจ่ายเรียบร้อยแล้ว

💸 ${item}
${amount.toLocaleString()} บาท`;
  }
};