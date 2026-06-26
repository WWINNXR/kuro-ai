import type { ParsedMessage } from "../openai";
import { getActiveTask, updateTask, finishTask } from "../task-manager";
import { handleReminder } from "./reminder";

export async function handleConversationTask(
  userId: string,
  parsed: ParsedMessage
): Promise<string | null> {
  const task = await getActiveTask(userId);

  if (!task) return null;

  if (task.task_type === "create_reminder") {
    const slots = task.slots ?? {};

    const updatedSlots = {
      ...slots,
      subject: slots.subject ?? parsed.subject,
      datetime: slots.datetime ?? parsed.datetime,
    };

    await updateTask(task.id, updatedSlots);

    if (!updatedSlots.subject) {
      return "อยากให้เตือนเรื่องอะไรครับ 🐾";
    }

    if (!updatedSlots.datetime) {
      return `อยากให้เตือนเรื่อง “${updatedSlots.subject}” วันไหนและกี่โมงครับ?`;
    }

    await finishTask(task.id);

    return handleReminder(userId, {
      ...parsed,
      intent: "create_reminder",
      subject: String(updatedSlots.subject),
      datetime: String(updatedSlots.datetime),
      language: parsed.language ?? "th",
      confidence: parsed.confidence ?? 1,
    });
  }

  return null;
}