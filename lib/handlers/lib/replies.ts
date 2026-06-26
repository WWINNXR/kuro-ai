export const Reply = {

  reminderCreated(subject, date){

    return `รับทราบครับ 🐾

ผมบันทึกการเตือนเรียบร้อยแล้ว

📌 ${subject}

🕒 ${date}`

  },

  expenseLogged(item, amount){

    return `รับทราบครับ 🐾

บันทึกรายจ่ายแล้ว

💸 ${item}

${amount.toLocaleString()} บาท`

  }

}