import { supabase } from "./supabase";

export async function getActiveTask(userId: string) {
  const { data } = await supabase
    .from("conversation_state")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return data;
}

export async function startTask(
  userId: string,
  taskType: string,
  slots: Record<string, unknown>
) {
  await supabase
    .from("conversation_state")
    .update({ status: "completed" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("conversation_state")
    .insert({
      user_id: userId,
      task_type: taskType,
      pending_intent: taskType,
      slots,
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateTask(
  id: string,
  slots: Record<string, unknown>
) {
  const { error } = await supabase
    .from("conversation_state")
    .update({
      slots,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function finishTask(id: string) {
  await supabase
    .from("conversation_state")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}