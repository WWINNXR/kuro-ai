import { supabase } from "./supabase";

interface GoogleCalendarEventInput {
  userId: string;
  title: string;
  startAt: Date;
  endAt?: Date;
  addMeet?: boolean;
}

export async function createGoogleCalendarEvent(
  input: GoogleCalendarEventInput
): Promise<{ htmlLink?: string; meetLink?: string } | null> {
  console.log("Google Calendar input:", {
    userId: input.userId,
    title: input.title,
    startAt: input.startAt.toISOString(),
    addMeet: input.addMeet,
  });

  const { data: account, error } = await supabase
    .from("google_accounts")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    console.error("Google account fetch error:", error);
    throw error;
  }

  console.log("Google Account found:", {
    hasAccount: !!account,
    userId: account?.user_id,
    googleEmail: account?.google_email,
    hasAccessToken: !!account?.access_token,
    hasRefreshToken: !!account?.refresh_token,
    expiresAt: account?.expires_at,
  });

  if (!account?.access_token) {
    console.warn("No Google access token for user:", input.userId);
    return null;
  }

  const accessToken = await getValidAccessToken(account);

  const endAt =
    input.endAt ?? new Date(input.startAt.getTime() + 60 * 60 * 1000);

  const body: Record<string, unknown> = {
    summary: input.title,
    start: {
      dateTime: input.startAt.toISOString(),
      timeZone: "Asia/Bangkok",
    },
    end: {
      dateTime: endAt.toISOString(),
      timeZone: "Asia/Bangkok",
    },
  };

  if (input.addMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    };
  }

  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
    (input.addMeet ? "?conferenceDataVersion=1" : "");

  console.log("Google Calendar request:", {
    url,
    body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  console.log("Google Calendar response:", {
    ok: res.ok,
    status: res.status,
    data,
  });

  if (!res.ok) {
    console.error("Google Calendar error:", data);
    return null;
  }

  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find(
      (p: { entryPointType?: string }) => p.entryPointType === "video"
    )?.uri;

  console.log("Google Calendar created:", {
    htmlLink: data.htmlLink,
    meetLink,
  });

  return {
    htmlLink: data.htmlLink,
    meetLink,
  };
}

async function getValidAccessToken(account: {
  id: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
}): Promise<string> {
  if (account.expires_at) {
    const expiresAt = new Date(account.expires_at).getTime();
    const now = Date.now();

    console.log("Google token expiry check:", {
      expiresAt: account.expires_at,
      remainingMs: expiresAt - now,
    });

    if (expiresAt - now > 60_000) {
      console.log("Using existing Google access token");
      return account.access_token;
    }
  }

  if (!account.refresh_token) {
    console.warn("No refresh token. Using existing access token.");
    return account.access_token;
  }

  console.log("Refreshing Google access token");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const token = await tokenRes.json();

  console.log("Google refresh token response:", {
    ok: tokenRes.ok,
    status: tokenRes.status,
    token,
  });

  if (!tokenRes.ok) {
    console.error("Google refresh token error:", token);
    return account.access_token;
  }

  const expiresAt = new Date(
    Date.now() + Number(token.expires_in ?? 3600) * 1000
  ).toISOString();

  const { error } = await supabase
    .from("google_accounts")
    .update({
      access_token: token.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  if (error) {
    console.error("Google token update error:", error);
  }

  return token.access_token;
}