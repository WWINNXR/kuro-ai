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
  | "save_memory"
  | "query_memory"
  | "save_preference"
  | "query_preference"
  | "casual_chat"
  | "mood_check"
  | "unknown";

export interface ParsedMessage {
  intent: Intent;
  subject?: string | null;
  datetime?: string | null;
  rrule?: string | null;
  amount?: number | null;
  due_date?: string | null;
  due_day?: number | null;
  recurrence?: "once" | "monthly" | "yearly" | null;
  direction?: "expense" | "income" | null;
  period?: "today" | "yesterday" | "week" | "month" | null;

  // Memory fields
  memory_category?:
    | "profile"
    | "preference"
    | "habit"
    | "relationship"
    | "goal"
    | "work"
    | "budget"
    | "location"
    | "other"
    | null;
  memory_key?: string | null;
  memory_value?: string | null;
  
  // Natural conversation fields
  preference_category?:
    | "food"
    | "drink"
    | "shop"
    | "place"
    | "lifestyle"
    | "other"
    | null;
  preference_value?: string | null;
  preference_sentiment?: "like" | "dislike" | "neutral" | null;
  mood?:
    | "happy"
    | "tired"
    | "stressed"
    | "sad"
    | "bored"
    | "neutral"
    | null;

  language: "th" | "en";
  confidence: number;
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Kuro AI, a personal LINE chatbot assistant for Thai users.

Your job is to parse user messages and return structured JSON — nothing else.

Today's date and time in Bangkok (UTC+7): {{NOW}}

Return ONLY valid JSON matching this exact structure:
{
  "intent": "<one of the intents below>",
  "subject": "<event title / reminder text / expense description / bill name / memory text>",
  "datetime": "<ISO 8601 full datetime in Bangkok time e.g. 2026-06-26T10:00:00+07:00 — only for events and reminders>",
  "rrule": "<RRULE string for recurring e.g. FREQ=MONTHLY;BYMONTHDAY=28 — null if one-time>",
  "amount": <number or null>,
  "due_date": "<YYYY-MM-DD for one-time bill due date>",
  "due_day": <1-31 for monthly recurring bill day, null otherwise>,
  "recurrence": "once|monthly|yearly|null",
  "direction": "expense|income|null",
  "period": "today|yesterday|week|month|null",
  "memory_category": "profile|preference|habit|relationship|goal|work|budget|location|other|null",
  "memory_key": "<short key for memory, e.g. nickname, favorite_coffee, monthly_budget, office, wake_time>",
  "memory_value": "<value to save or query, e.g. Win, Americano, 25000, CPF>",
  "preference_category": "food|drink|shop|place|lifestyle|other|null",
  "preference_value": "<preference value such as ร้านนี้, Koi, อเมริกาโน่>",
  "preference_sentiment": "like|dislike|neutral|null",
  "mood": "happy|tired|stressed|sad|bored|neutral|null",
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
- log_expense       → user logs spending (กาแฟ 120, spent 50 on lunch)
- log_income        → user logs income (รับเงิน, เงินเดือนเข้า, income)
- query_spending    → user asks how much spent (ใช้เงินเท่าไหร่, how much this month)
- query_summary     → user asks for a daily overview (สรุปวันนี้, วันนี้มีอะไรบ้าง, what do I have today)
- set_briefing_time → user wants to change morning summary time
- save_memory       → user tells Kuro to remember personal information
- query_memory      → user asks about remembered personal information
- save_preference   → user expresses likes/dislikes/preferences เช่น ร้านนี้อร่อย, ร้านนี้ไม่เอาแล้ว, ชอบร้านนี้
- query_preference  → user asks what they like/dislike เช่น เราชอบร้านไหน, ร้านไหนไม่เอาแล้ว
- casual_chat       → user wants to chat casually เช่น คุยเล่นหน่อย, เบื่อจัง, hello
- mood_check        → user expresses emotion/mood เช่น วันนี้เหนื่อย, เครียด, เบื่อ, ดีใจ
- unknown           → cannot determine intent

Memory examples:
- "เรียกเราว่าวิน" → save_memory, memory_category="profile", memory_key="nickname", memory_value="วิน"
- "จำไว้ว่าเราชอบอเมริกาโน่" → save_memory, memory_category="preference", memory_key="favorite_coffee", memory_value="อเมริกาโน่"
- "เราทำงานที่ CPF" → save_memory, memory_category="work", memory_key="office", memory_value="CPF"
- "งบเดือนละ 25000" → save_memory, memory_category="budget", memory_key="monthly_budget", memory_value="25000", amount=25000
- "ปกติตื่น 7 โมง" → save_memory, memory_category="habit", memory_key="wake_time", memory_value="07:00"
- "บ้านเราอยู่พระประแดง" → save_memory, memory_category="location", memory_key="home_location", memory_value="พระประแดง"
- "เราชื่ออะไร" → query_memory, memory_category="profile", memory_key="nickname"
- "เราชอบกาแฟอะไร" → query_memory, memory_category="preference", memory_key="favorite_coffee"
- "งบเราต่อเดือนเท่าไหร่" → query_memory, memory_category="budget", memory_key="monthly_budget"
- "เราทำงานที่ไหน" → query_memory, memory_category="work", memory_key="office"

Rules:
- Detect language from the message. Thai = "th", English = "en".
- For relative dates: พรุ่งนี้=tomorrow, วันนี้=today, อาทิตย์หน้า=next week, compute from NOW.
- For times: บ่ายสอง=14:00, สิบโมง=10:00, เที่ยง=12:00, ทุ่มครึ่ง=19:30
- Short expense messages like "กาแฟ 120" = log_expense with subject=กาแฟ amount=120
- If only an amount and item are given with no time, it is an expense, not a reminder.
- If user says "จำไว้ว่า...", "เรียกเราว่า...", "เราชอบ...", "ปกติเรา...", classify as save_memory.
- If user asks "จำได้ไหมว่า...", "เราชื่ออะไร", "เราชอบอะไร", "งบเราเท่าไหร่", classify as query_memory.
- If user says something is good, delicious, nice, or they like it, classify as save_preference.
- If user says "ร้านนี้อร่อย", use save_preference, preference_category="shop", preference_sentiment="like", preference_value="ร้านนี้".
- If user says "ร้านนี้ไม่เอาแล้ว", use save_preference, preference_category="shop", preference_sentiment="dislike", preference_value="ร้านนี้".
- If user says "น้ำร้านนี้อร่อย", use save_preference, preference_category="drink", preference_sentiment="like", preference_value="น้ำร้านนี้".
- If user asks "เราชอบร้านไหน", "ร้านไหนที่ไม่ชอบ", classify as query_preference.
- If user says they are tired, stressed, sad, bored, classify as mood_check.
- If user says casual phrases without clear task, classify as casual_chat.
- Return null for unused fields, never omit keys.
- Always set confidence honestly.
- Unknown intent = confidence < 0.6.`;

// ── Parse function ────────────────────────────────────────────────────────────

export async function parseMessage(
  text: string,
  nowBangkok: string
): Promise<ParsedMessage> {
  const prompt = SYSTEM_PROMPT.replace("{{NOW}}", nowBangkok);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 500,
  });

  const raw = response.choices[0].message.content ?? "{}";

  try {
    const parsed = JSON.parse(raw) as ParsedMessage;

    return {
      intent: parsed.intent ?? "unknown",
      subject: parsed.subject ?? null,
      datetime: parsed.datetime ?? null,
      rrule: parsed.rrule ?? null,
      amount: parsed.amount ?? null,
      due_date: parsed.due_date ?? null,
      due_day: parsed.due_day ?? null,
      recurrence: parsed.recurrence ?? null,
      direction: parsed.direction ?? null,
      period: parsed.period ?? null,
      memory_category: parsed.memory_category ?? null,
      memory_key: parsed.memory_key ?? null,
      memory_value: parsed.memory_value ?? null,
      preference_category: parsed.preference_category ?? null,
      preference_value: parsed.preference_value ?? null,
      preference_sentiment: parsed.preference_sentiment ?? null,
      mood: parsed.mood ?? null,
      language: parsed.language ?? "th",
      confidence: parsed.confidence ?? 0,
    };
  } catch {
    return {
      intent: "unknown",
      subject: null,
      datetime: null,
      rrule: null,
      amount: null,
      due_date: null,
      due_day: null,
      recurrence: null,
      direction: null,
      period: null,
      memory_category: null,
      memory_key: null,
      memory_value: null,
      preference_category: null,
      preference_value: null,
      preference_sentiment: null,
      mood: null,
      language: "th",
      confidence: 0,
    };
  }
}