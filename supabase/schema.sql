-- ============================================================
-- Kuro AI — Database Schema V1
-- Run this in Supabase SQL Editor once
-- ============================================================

-- Users (identified by LINE user ID only — no auth needed)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id  TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Bangkok',
  language      TEXT NOT NULL DEFAULT 'th',
  briefing_time TIME NOT NULL DEFAULT '07:00:00',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  remind_at   TIMESTAMPTZ NOT NULL,
  rrule       TEXT,                              -- NULL = one-time; RRULE string = recurring
  status      TEXT NOT NULL DEFAULT 'active',   -- active | snoozed | done | cancelled
  fired_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reminders_fire_idx ON reminders(remind_at, status);

-- Events / Appointments
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS events_user_start_idx ON events(user_id, start_at);

-- Bills
CREATE TABLE IF NOT EXISTS bills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(12,2),                   -- NULL = variable/unknown
  currency     CHAR(3) NOT NULL DEFAULT 'THB',
  due_day      SMALLINT,                        -- day of month for recurring
  next_due_at  DATE NOT NULL,
  recurrence   TEXT NOT NULL DEFAULT 'once',    -- once | monthly | yearly
  status       TEXT NOT NULL DEFAULT 'unpaid',  -- unpaid | paid | overdue
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS bills_user_due_idx ON bills(user_id, next_due_at, status);

-- Expenses & Income
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  currency     CHAR(3) NOT NULL DEFAULT 'THB',
  direction    TEXT NOT NULL DEFAULT 'expense',  -- expense | income
  spent_at     DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS expenses_user_date_idx ON expenses(user_id, spent_at, direction);

-- Daily briefing log (prevents duplicate sends)
CREATE TABLE IF NOT EXISTS briefing_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sent_date    DATE NOT NULL,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sent_date)
);

-- ============================================================
-- Row Level Security (enable but allow service_role full access)
-- ============================================================
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills       ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefing_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically (used by our server)
-- No additional policies needed for a LINE-only chatbot
