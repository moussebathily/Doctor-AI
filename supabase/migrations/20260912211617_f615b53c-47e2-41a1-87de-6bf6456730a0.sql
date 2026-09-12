CREATE TABLE public.cardiac_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name text NOT NULL DEFAULT 'Patient 01',
  patient_age integer NOT NULL DEFAULT 58,
  scenario text NOT NULL DEFAULT 'VFIB',
  health integer NOT NULL DEFAULT 90,
  rhythm text NOT NULL DEFAULT 'VFIB',
  shock_count integer NOT NULL DEFAULT 0,
  time_remaining integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'active',
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_tick_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cardiac_sessions TO authenticated;
GRANT ALL ON public.cardiac_sessions TO service_role;
ALTER TABLE public.cardiac_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cardiac sessions" ON public.cardiac_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER cardiac_sessions_touch BEFORE UPDATE ON public.cardiac_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cardiac_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cardiac_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cardiac_messages TO authenticated;
GRANT ALL ON public.cardiac_messages TO service_role;
ALTER TABLE public.cardiac_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cardiac messages" ON public.cardiac_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX cardiac_messages_session_idx ON public.cardiac_messages(session_id, created_at);
CREATE INDEX cardiac_sessions_user_idx ON public.cardiac_sessions(user_id, created_at DESC);