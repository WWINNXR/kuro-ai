import { supabase } from "../supabase";
import type { ParsedMessage } from "../openai";

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

  if (parsed.language === "th") {
    if (sentiment === "like") {
      return `จำไว้ให้แล้วครับ 🐾

คุณชอบ ${value}

ครั้งหน้าถ้าเกี่ยวกับเรื่องนี้ ผมจะจำไว้เป็นตัวเลือกที่ดีครับ`;
    }

    if (sentiment === "dislike") {
      return `โอเคครับ 🐾

ผมจะจำไว้ว่า ${value} ไม่ใช่ตัวเลือกที่คุณอยากได้

ครั้งหน้าผมจะพยายามหลีกเลี่ยงให้ครับ`;
    }

    return `จำไว้ให้แล้วครับ 🐾

${value}`;
  }

  return `Saved to preference memory 🐾

${value}`;
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

  const likes = data.filter((p) => p.sentiment === "like");
  const dislikes = data.filter((p) => p.sentiment === "dislike");

  if (parsed.language === "th") {
    let reply = "ผมจำความชอบของคุณไว้ประมาณนี้ครับ 🐾";

    if (likes.length > 0) {
      reply += `

ชอบ:
${likes.map((p) => `• ${p.value}`).join("\n")}`;
    }

    if (dislikes.length > 0) {
      reply += `

ไม่ค่อยชอบ / อยากเลี่ยง:
${dislikes.map((p) => `• ${p.value}`).join("\n")}`;
    }

    return reply;
  }

  return `Here’s what I remember 🐾

${data.map((p) => `• ${p.sentiment}: ${p.value}`).join("\n")}`;
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

  if (parsed.language === "th") {
    if (mood === "tired") {
      return `เหนื่อยใช่ไหมครับ 🐾

ผมรับรู้ไว้แล้วนะ

วันนี้ลองพักสั้น ๆ สัก 10 นาที แล้วค่อยกลับมาจัดการต่อก็ได้ครับ`;
    }

    if (mood === "stressed") {
      return `เข้าใจครับ 🐾

วันนี้ดูเหมือนจะมีเรื่องกดดันอยู่

ถ้าต้องการ ผมช่วยจัดลำดับสิ่งที่ต้องทำให้เบาลงได้ครับ`;
    }

    if (mood === "sad") {
      return `ผมอยู่ตรงนี้นะครับ 🐾

ถ้าอยากคุยเล่นหรือระบายอะไร พิมพ์มาได้เลย`;
    }

    if (mood === "bored") {
      return `เบื่อนิด ๆ ใช่ไหมครับ 🐾

จะให้ผมช่วยหาอะไรทำ หรือคุยเล่นเป็นเพื่อนก็ได้นะ`;
    }

    if (mood === "happy") {
      return `ดีใจด้วยครับ 🐾

ผมบันทึกโมเมนต์ดี ๆ นี้ไว้ให้แล้ว`;
    }

    return `รับรู้ไว้แล้วครับ 🐾`;
  }

  return `I hear you 🐾`;
}

export async function handleCasualChat(
  userId: string,
  parsed: ParsedMessage
): Promise<string> {
  const text = parsed.subject ?? "";

  if (parsed.language === "th") {
    if (text.includes("สวัสดี") || text.includes("หวัดดี")) {
      return `สวัสดีครับ 🐾

ผมอยู่ตรงนี้แล้ว มีอะไรให้ช่วยหรืออยากคุยเล่นก็บอกได้เลย`;
    }

    return `คุยได้เลยครับ 🐾

วันนี้อยากให้ผมช่วยอะไร หรืออยากเล่าอะไรให้ฟังก็ได้`;
  }

  return `I'm here 🐾

You can chat with me anytime.`;
}