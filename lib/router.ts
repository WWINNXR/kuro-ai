import type { ParsedMessage } from "./openai";
import { startTask } from "./task-manager";

import { handleReminder } from "./handlers/reminder";
import {
  handleCreateEvent,
  handleQueryEvents,
} from "./handlers/calendar";
import {
  handleCreateBill,
  handleQueryBills,
  handleMarkBillPaid,
} from "./handlers/bills";
import {
  handleLogExpense,
  handleQuerySpending,
} from "./handlers/expenses";
import { buildDailySummary } from "./handlers/summary";
import {
  handleSaveMemory,
  handleQueryMemory,
} from "./handlers/memory";

export async function routeIntent(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  switch (parsed.intent) {
    case "create_reminder": {
      if (!parsed.subject || !parsed.datetime) {
        await startTask(userId, "create_reminder", {
          subject: parsed.subject ?? null,
          datetime: parsed.datetime ?? null,
        });

        return !parsed.subject
          ? "อยากให้เตือนเรื่องอะไรครับ 🐾"
          : `อยากให้เตือนเรื่อง “${parsed.subject}” วันไหนและกี่โมงครับ 🐾`;
      }

      return handleReminder(userId, parsed);
    }

    case "create_event":
      return handleCreateEvent(userId, parsed);

    case "query_events":
      return handleQueryEvents(userId, parsed);

    case "create_bill":
      return handleCreateBill(userId, parsed);

    case "query_bills":
      return handleQueryBills(userId, parsed);

    case "mark_bill_paid":
      return handleMarkBillPaid(userId, parsed);

    case "log_expense":
      return handleLogExpense(userId, parsed, "expense");

    case "log_income":
      return handleLogExpense(userId, parsed, "income");

    case "query_spending":
      return handleQuerySpending(userId, parsed);

    case "query_summary":
      return buildDailySummary(userId, parsed.language);

    case "save_memory":
      return handleSaveMemory(userId, parsed);

    case "query_memory":
      return handleQueryMemory(userId, parsed);

    default:
      return parsed.language === "th"
        ? `ขออภัยครับ 🐾

ผมยังไม่แน่ใจว่าคุณต้องการให้ช่วยเรื่องอะไร

ลองพิมพ์ตัวอย่างแบบนี้ได้เลย

📌 เตือนประชุมพรุ่งนี้ 10 โมง
💸 กาแฟ 120
📅 วันนี้มีนัดอะไรบ้าง
💳 เดือนนี้ต้องจ่ายอะไรบ้าง
🧠 จำไว้ว่าเราชอบอเมริกาโน่`
        : `Sorry 🐾

I'm not quite sure what you mean.

Try one of these:

📌 Remind me about the meeting tomorrow at 10am
💸 Coffee 120
📅 What do I have today?
💳 What bills are due this month?
🧠 Remember that I like Americano`;
  }
}