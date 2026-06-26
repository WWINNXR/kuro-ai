import { supabase } from "./supabase";

export interface KuroContext {
  profile: {
    nickname?: string | null;
    monthly_budget?: number | null;
    wake_time?: string | null;
    office_location?: string | null;
    home_location?: string | null;
  } | null;

  todayExpense: number;
  monthExpense: number;
  unpaidBillsCount: number;
  unpaidBillsTotal: number;
  upcomingBills: Array<{
    name: string;
    amount: number | null;
    next_due_at: string;
  }>;

  todayEvents: Array<{
    title: string;
    start_at: string;
  }>;

  memories: Array<{
    category: string;
    content: string;
  }>;
}

export async function buildContext(userId: string): Promise<KuroContext> {
  const TZ = "Asia/Bangkok";
  const now = new Date();

  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("en-CA", { timeZone: TZ });

  const todayStart = `${todayStr}T00:00:00+07:00`;
  const todayEnd = `${todayStr}T23:59:59+07:00`;

  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenDaysLaterStr = sevenDaysLater.toLocaleDateString("en-CA", {
    timeZone: TZ,
  });

  const { data: profile } = await supabase
    .from("user_profile")
    .select(
      "nickname, monthly_budget, wake_time, office_location, home_location"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const { data: todayExpenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", "expense")
    .eq("spent_at", todayStr);

  const todayExpense = (todayExpenses ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  const { data: monthExpenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", userId)
    .eq("direction", "expense")
    .gte("spent_at", monthStart)
    .lte("spent_at", todayStr);

  const monthExpense = (monthExpenses ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );

  const { data: unpaidBills } = await supabase
    .from("bills")
    .select("name, amount, next_due_at")
    .eq("user_id", userId)
    .eq("status", "unpaid")
    .gte("next_due_at", todayStr)
    .lte("next_due_at", sevenDaysLaterStr)
    .order("next_due_at")
    .limit(5);

  const unpaidBillsTotal = (unpaidBills ?? []).reduce(
    (sum, bill) => sum + Number(bill.amount ?? 0),
    0
  );

  const { data: todayEvents } = await supabase
    .from("events")
    .select("title, start_at")
    .eq("user_id", userId)
    .gte("start_at", todayStart)
    .lte("start_at", todayEnd)
    .order("start_at")
    .limit(5);

  const { data: memories } = await supabase
    .from("memories")
    .select("category, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    profile: profile ?? null,
    todayExpense,
    monthExpense,
    unpaidBillsCount: unpaidBills?.length ?? 0,
    unpaidBillsTotal,
    upcomingBills: unpaidBills ?? [],
    todayEvents: todayEvents ?? [],
    memories: memories ?? [],
  };
}

export function getDisplayName(context: KuroContext): string {
  return context.profile?.nickname ?? "คุณ";
}

export function getRemainingBudget(context: KuroContext): number | null {
  const budget = context.profile?.monthly_budget;

  if (!budget) return null;

  return Number(budget) - context.monthExpense;
}