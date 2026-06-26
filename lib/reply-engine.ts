import OpenAI from "openai";
import type { ParsedMessage } from "./openai";
import type { KuroContext } from "./context";

if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ReplyEngineInput {
  parsed: ParsedMessage;
  context?: KuroContext;
  result?: string;
  userMessage?: string;
}

export async function generateReply(input: ReplyEngineInput): Promise<string> {
  const name = input.context?.profile?.nickname ?? "คุณ";

  const contextText = buildContextText(input.context);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You are Kuro AI, a warm and intelligent personal secretary inside LINE.

Speak Thai naturally when the user speaks Thai.
Be concise, helpful, calm, and friendly.
Do not over-explain.
Do not sound like a customer service bot.
Use 🐾 occasionally, not every sentence.
Always confirm actions clearly.
If the user is tired, stressed, or bored, respond warmly like a supportive assistant.
If something was saved to memory/preferences, confirm naturally.
Do not invent facts not in context.

User name: ${name}

User context:
${contextText}`,
      },
      {
        role: "user",
        content: `User message:
${input.userMessage ?? input.parsed.subject ?? ""}

Parsed:
intent=${input.parsed.intent}
domain=${input.parsed.domain}
action=${input.parsed.action}
reply_hint=${input.parsed.reply_hint}

Execution result:
${input.result ?? "No extra result"}

Write the final LINE reply.`,
      },
    ],
  });

  return response.choices[0].message.content?.trim() ?? "รับทราบครับ 🐾";
}

function buildContextText(context?: KuroContext): string {
  if (!context) return "No context available.";

  const lines: string[] = [];

  if (context.profile?.nickname) {
    lines.push(`Nickname: ${context.profile.nickname}`);
  }

  if (context.profile?.monthly_budget) {
    lines.push(`Monthly budget: ${context.profile.monthly_budget}`);
  }

  lines.push(`Today expense: ${context.todayExpense}`);
  lines.push(`Month expense: ${context.monthExpense}`);

  if (context.unpaidBillsCount > 0) {
    lines.push(
      `Upcoming bills: ${context.unpaidBillsCount}, total ${context.unpaidBillsTotal}`
    );
  }

  if (context.todayEvents.length > 0) {
    lines.push(
      `Today events: ${context.todayEvents.map((e) => e.title).join(", ")}`
    );
  }

  if (context.memories.length > 0) {
    lines.push(
      `Memories: ${context.memories
        .map((m) => `${m.category}: ${m.content}`)
        .join("; ")}`
    );
  }

  return lines.join("\n");
}