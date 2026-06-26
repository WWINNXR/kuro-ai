import type { ParsedMessage } from "./openai";
import type { KuroContext } from "./context";

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

import {
  handleSavePreference,
  handleQueryPreference,
  handleMoodCheck,
  handleCasualChat,
} from "./handlers/natural";

function displayName(context?: KuroContext): string {
  return context?.profile?.nickname ?? "คุณ";
}

export async function routeIntent(
  userId: string,
  parsed: ParsedMessage,
  context?: KuroContext
): Promise<string> {
  const name = displayName(context);

  switch (parsed.intent) {
    case "create_reminder": {
      if (!parsed.subject || !parsed.datetime) {
        await startTask(userId, "create_reminder", {
          subject: parsed.subject ?? null,
          datetime: parsed.datetime ?? null,
        });

        return !parsed.subject
          ? `${name} อยากให้เตือนเรื่องอะไรครับ 🐾`
          : `${name} อยากให้เตือนเรื่อง “${parsed.subject}” วันไหนและกี่โมงครับ 🐾`;
      }

      return await handleReminder(userId, parsed);
    }

    case "create_event":
      return await handleCreateEvent(userId, parsed);

    case "query_events":
      return await handleQueryEvents(userId, parsed);

    case "create_bill":
      return await handleCreateBill(userId, parsed);

    case "query_bills":
      return await handleQueryBills(userId, parsed);

    case "mark_bill_paid":
      return await handleMarkBillPaid(userId, parsed);

    case "log_expense":
      return await handleLogExpense(userId, parsed, "expense");

    case "log_income":
      return await handleLogExpense(userId, parsed, "income");

    case "query_spending":
      return await handleQuerySpending(userId, parsed);

    case "query_summary":
      return await buildDailySummary(userId, parsed.language);

    case "save_memory":
      return await handleSaveMemory(userId, parsed);

    case "query_memory":
      return await handleQueryMemory(userId, parsed);

    case "save_preference":
      return await handleSavePreference(userId, parsed);

    case "query_preference":
      return await handleQueryPreference(userId, parsed);

    case "mood_check":
      return await handleMoodCheck(userId, parsed);

    case "casual_chat":
      return await handleCasualChat(userId, parsed);

    case "connect_google":
      return `ได้ครับ ${name} 🐾

กดลิงก์นี้เพื่อเชื่อม Google Calendar กับ Kuro:

https://kuro-ai-black.vercel.app/api/google/connect?userId=${userId}

หลังเชื่อมเสร็จ ผมจะสามารถสร้างนัดลง Google Calendar และสร้าง Google Meet link ให้ได้ครับ`;

    default:
      return parsed.language === "th"
        ? `ขออภัยครับ ${name} 🐾

ผมยังไม่แน่ใจว่าคุณต้องการให้ช่วยเรื่องอะไร

ตัวอย่างที่ลองได้

📌 เตือนประชุมพรุ่งนี้ 10 โมง
💸 กาแฟ 120
📅 วันนี้มีนัดอะไร
💳 เดือนนี้ต้องจ่ายอะไร
🧠 จำไว้ว่าผมชื่อวิน
🍹 น้ำร้านนี้อร่อย
😮‍💨 วันนี้เหนื่อยมาก
🔗 เชื่อม Google Calendar`
        : `Sorry ${name} 🐾

I'm not sure what you mean.

Try:

📌 Remind me tomorrow at 10am
💸 Coffee 120
📅 What do I have today?
💳 What bills are due?
🧠 Remember my name is Win
🍹 This drink is good
😮‍💨 I'm tired today
🔗 Connect Google Calendar`;
  }
}