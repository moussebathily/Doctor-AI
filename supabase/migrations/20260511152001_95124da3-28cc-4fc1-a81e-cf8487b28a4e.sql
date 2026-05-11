-- Surgery progress table
CREATE TABLE public.surgery_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  operation_id TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 100,
  completed BOOLEAN NOT NULL DEFAULT false,
  debrief TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, operation_id)
);

ALTER TABLE public.surgery_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own surgery progress all" ON public.surgery_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER surgery_progress_touch
  BEFORE UPDATE ON public.surgery_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pharmacy order ETA
ALTER TABLE public.pharmacy_orders
  ADD COLUMN IF NOT EXISTS estimated_ready_at TIMESTAMPTZ;