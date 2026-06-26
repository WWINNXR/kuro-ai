import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");

  if (!code || !userId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const token = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: token }, { status: 400 });
  }

  const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  const userInfo = await userInfoRes.json();

  const expiresAt = new Date(
    Date.now() + Number(token.expires_in ?? 3600) * 1000
  ).toISOString();

  await supabase.from("google_accounts").upsert(
    {
      user_id: userId,
      google_email: userInfo.email,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt,
      scope: token.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return new NextResponse(
    "Google Calendar connected successfully. You can close this page."
  );
}

export const dynamic = "force-dynamic";