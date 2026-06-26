import OpenAI from "openai";
import type { ParsedMessage } from "./openai";
import type { KuroContext } from "./context";

if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface AiReplyInput {
  userMessage: string;
  parsed: ParsedMessage;
  context?: KuroContext;
  extra?: string;
}

export async function aiReply(input: AiReplyInput): Promise<string> {
  const name = input.context?.profile?.nickname ?? "คุณ";

  const contextText = buildContextText(input.context);

  console.log("=== AI REPLY CALLED ===");
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 350,
    messages: [
      {
        role: "system",
        content: `You are Kuro AI, a warm and intelligent personal secretary inside LINE.

Speak naturally in Thai if the user speaks Thai.
Be concise, helpful, calm, and friendly.
Do not sound like a customer service bot.
Use 🐾 occasionally, not every sentence.
You may chat casually, comfort the user, and confirm actions clearly.
Do not invent data that is not in the context.

User name: ${name}

User context:
${contextText}`,
      },
      {
        role: "user",
        content: `User message:
${input.userMessage}

Parsed intent:
${input.parsed.intent}

Extra result/context:
${input.extra ?? "None"}

Write the final LINE reply.`,
      },
    ],
  });

  return (
    response.choices[0].message.content?.trim() ??
    "รับทราบครับ 🐾"
  );
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
      `Today events: ${context.todayEvents
        .map((e) => e.title)
        .join(", ")}`
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