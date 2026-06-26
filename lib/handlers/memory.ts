import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

export async function handleSaveMemory(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  if (!parsed.memory_key || !parsed.memory_value) {
    return parsed.language === "th"
      ? "ขอข้อมูลเพิ่มนิดนึงครับ 🐾\nอยากให้ผมจำเรื่องอะไร?"
      : "Could you tell me what you want me to remember?";
  }

  const category = parsed.memory_category ?? "other";
  const key = parsed.memory_key;
  const value = parsed.memory_value;

  if (key === "nickname") {
    await upsertUserProfile(userId, { nickname: value });

    return parsed.language === "th"
      ? `รับทราบครับ 🐾\n\nจากนี้ผมจะเรียกคุณว่า “${value}”`
      : `Got it 🐾\n\nI'll call you "${value}" from now on.`;
  }

  if (key === "monthly_budget") {
    const amount = Number(value.replace(/[^\d.]/g, ""));

    if (!Number.isNaN(amount)) {
      await upsertUserProfile(userId, { monthly_budget: amount });
    }
  }

  if (key === "wake_time") {
    await upsertUserProfile(userId, { wake_time: value });
  }

  if (key === "office") {
    await upsertUserProfile(userId, { office_location: value });
  }

  if (key === "home_location") {
    await upsertUserProfile(userId, { home_location: value });
  }

  const { error } = await supabase.from("memories").insert({
    user_id: userId,
    category,
    content: `${key}: ${value}`,
    importance: category === "profile" ? 3 : 1,
  });

  if (error) throw error;

  return parsed.language === "th"
    ? `จำไว้ให้แล้วครับ 🐾\n\n${value}`
    : `Saved to memory 🐾\n\n${value}`;
}

export async function handleQueryMemory(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const key = parsed.memory_key;

  const { data: profile } = await supabase
    .from("user_profile")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (key === "nickname" && profile?.nickname) {
    return parsed.language === "th"
      ? `คุณชื่อ “${profile.nickname}” ครับ 🐾`
      : `Your name is "${profile.nickname}" 🐾`;
  }

  if (key === "monthly_budget" && profile?.monthly_budget) {
    return parsed.language === "th"
      ? `งบต่อเดือนของคุณคือ ${Number(profile.monthly_budget).toLocaleString(
          "th-TH"
        )} บาทครับ`
      : `Your monthly budget is ${Number(profile.monthly_budget).toLocaleString(
          "th-TH"
        )} THB`;
  }

  if (key === "wake_time" && profile?.wake_time) {
    return parsed.language === "th"
      ? `ปกติคุณตื่นประมาณ ${profile.wake_time} ครับ 🐾`
      : `You usually wake up around ${profile.wake_time} 🐾`;
  }

  if (key === "office" && profile?.office_location) {
    return parsed.language === "th"
      ? `คุณทำงานที่ ${profile.office_location} ครับ`
      : `You work at ${profile.office_location}`;
  }

  if (key === "home_location" && profile?.home_location) {
    return parsed.language === "th"
      ? `บ้านของคุณอยู่ที่ ${profile.home_location} ครับ`
      : `Your home is in ${profile.home_location}`;
  }

  const { data: memories, error } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  if (!memories || memories.length === 0) {
    return parsed.language === "th"
      ? "ตอนนี้ผมยังไม่มีข้อมูลที่จำไว้เกี่ยวกับเรื่องนี้ครับ 🐾"
      : "I don't have any memory about that yet 🐾";
  }

  const lines = memories.map((m) => `• ${m.content}`);

  return parsed.language === "th"
    ? `สิ่งที่ผมจำไว้ตอนนี้ครับ 🐾\n\n${lines.join("\n")}`
    : `Here’s what I remember 🐾\n\n${lines.join("\n")}`;
}

async function upsertUserProfile(
  userId: string,
  updates: Record<string, unknown>
) {
  const { data: existing, error: findError } = await supabase
    .from("user_profile")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (findError) throw findError;

  if (existing) {
    const { error } = await supabase
      .from("user_profile")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("user_profile").insert({
    user_id: userId,
    ...updates,
  });

  if (error) throw error;
}