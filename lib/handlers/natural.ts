import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";
import { buildContext } from "../context";
import { generateReply } from "../reply-engine";

export async function handleSavePreference(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const category = parsed.preference_category ?? "other";
  const value = parsed.preference_value ?? parsed.subject;
  const sentiment = parsed.preference_sentiment ?? "neutral";

  if (!value) {
    return parsed.language === "th"
      ? "อยากให้ผมจำความชอบเรื่องอะไรครับ 🐾"
      : "What preference would you like me to remember?";
  }

  const { error } = await supabase.from("preferences").insert({
    user_id: userId,
    category,
    value,
    sentiment,
    confidence: parsed.confidence ?? 1,
  });

  if (error) throw error;

  const context = await buildContext(userId);

  return generateReply({
    parsed,
    context,
    result: `Saved preference: category=${category}, value=${value}, sentiment=${sentiment}`,
    userMessage: parsed.subject ?? value,
  });
}

export async function handleQueryPreference(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const category = parsed.preference_category;

  let query = supabase
    .from("preferences")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;

  if (error) throw error;

  if (!data || data.length === 0) {
    return parsed.language === "th"
      ? "ตอนนี้ผมยังไม่มีข้อมูลความชอบเรื่องนี้ครับ 🐾"
      : "I don't have preference memory about that yet 🐾";
  }

  const context = await buildContext(userId);

  return generateReply({
    parsed,
    context,
    result: `User preferences:\n${data
      .map((p) => `- ${p.category}: ${p.value} (${p.sentiment})`)
      .join("\n")}`,
    userMessage: parsed.subject ?? "query preference",
  });
}

export async function handleMoodCheck(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const mood = parsed.mood ?? "neutral";
  const note = parsed.subject ?? null;

  const { error } = await supabase.from("mood_logs").insert({
    user_id: userId,
    mood,
    note,
  });

  if (error) throw error;

  const context = await buildContext(userId);

  return generateReply({
    parsed,
    context,
    result: `Saved mood log: mood=${mood}, note=${note ?? ""}`,
    userMessage: parsed.subject ?? mood,
  });
}

export async function handleCasualChat(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const context = await buildContext(userId);

  return generateReply({
    parsed,
    context,
    result: "Casual conversation. No database action required.",
    userMessage: parsed.subject ?? "",
  });
}