import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Types ────────────────────────────────────────────────────────────────────

export type Intent =
  | "create_reminder"
  | "create_event"
  | "query_events"
  | "create_bill"
  | "query_bills"
  | "mark_bill_paid"
  | "log_expense"
  | "log_income"
  | "query_spending"
  | "query_summary"
  | "set_briefing_time"
  | "unknown";

export interface ParsedMessage {
  intent: Intent;
  subject?: string;       // reminder subject, event title, bill name, expense description
  datetime?: string;      // ISO 8601 string for event/reminder time
  rrule?: string;         // recurring rule e.g. "FREQ=MONTHLY;BYMONTHDAY=28"
  amount?: number;        // expense/bill amount
  due_date?: string;      // bill due date YYYY-MM-DD
  due_day?: number;       // bill due day of month (1-31)
  recurrence?: "once" | "monthly" | "yearly";
  direction?: "expense" | "income";
  period?: "today" | "yesterday" | "week" | "month"; // for queries
  language: "th" | "en";
  confidence: number;     // 0-1
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Kuro AI, a personal LINE chatbot assistant for Thai users.
Your job is to parse user messages and return structured JSON — nothing else.

Today's date and time in Bangkok (UTC+7): {{NOW}}

Return ONLY valid JSON matching this exact structure:
{
  "intent": "<one of the intents below>",
  "subject": "<event title / reminder text / expense description / bill name>",
  "datetime": "<ISO 8601 full datetime in Bangkok time e.g. 2025-06-26T10:00:00+07:00 — only for events and reminders>",
  "rrule": "<RRULE string for recurring e.g. FREQ=MONTHLY;BYMONTHDAY=28 — null if one-time>",
  "amount": <number or null>,
  "due_date": "<YYYY-MM-DD for one-time bill due date>",
  "due_day": <1-31 for monthly recurring bill day, null otherwise>,
  "recurrence": "once|monthly|yearly",
  "direction": "expense|income",
  "period": "today|yesterday|week|month",
  "language": "th|en",
  "confidence": <0.0-1.0>
}

Valid intents:
- create_reminder   → user wants a reminder at a specific time (เตือน, remind me)
- create_event      → user wants to add an appointment/meeting (เพิ่มนัด, add meeting)
- query_events      → user asks what appointments they have (วันนี้มีนัดอะไร, what's today)
- create_bill       → user logs a recurring or one-time bill (ค่าไฟ, Netflix ทุกวันที่ 15)
- query_bills       → user asks about bills due (ต้องจ่ายอะไร, what bills)
- mark_bill_paid    → user says they paid a bill (จ่ายแล้ว, paid)
- log_expense       → user logs a spending (กาแฟ 120, spent 50 on lunch)
- log_income        → user logs income (รับเงิน, เงินเดือนเข้า, income)
- query_spending    → user asks how much spent (ใช้เงินเท่าไหร่, how much this month)
- query_summary     → user asks for a daily overview (สรุปวันนี้, what do I have today)
- set_briefing_time → user wants to change morning summary time
- unknown           → cannot determine intent (confidence < 0.6)

Rules:
- Detect language from the message. Thai = "th", English = "en".
- For relative dates: พรุ่งนี้=tomorrow, วันนี้=today, อาทิตย์หน้า=next week, compute from NOW.
- For times: บ่ายสอง=14:00, สิบโมง=10:00, เที่ยง=12:00, ทุ่มครึ่ง=19:30
- Short expense messages like "กาแฟ 120" = log_expense with subject=กาแฟ amount=120
- If only an amount and item are given with no time, it is an expense, not a reminder.
- Return null for unused fields, never omit keys.
- Always set confidence honestly. Unknown intent = confidence < 0.6.`;

// ── Parse function ────────────────────────────────────────────────────────────

export async function parseMessage(
  text: string,
  nowBangkok: string
): Promise<ParsedMessage> {
  const prompt = SYSTEM_PROMPT.replace("{{NOW}}", nowBangkok);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",          // fast + cheap for classification
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 400,
  });

  const raw = response.choices[0].message.content ?? "{}";

  try {
    return JSON.parse(raw) as ParsedMessage;
  } catch {
    return {
      intent: "unknown",
      language: "th",
      confidence: 0,
    };
  }
}
