
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- reminders
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('medicament','rdv','analyse')),
  title text not null,
  dose text,
  time time,
  date date,
  repeat text default 'daily',
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.reminders enable row level security;
create policy "own reminders all" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- lab_simulations
create table public.lab_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  patient jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.lab_simulations enable row level security;
create policy "own sims all" on public.lab_simulations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text default 'Nouvelle consultation',
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create policy "own conv all" on public.conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "own messages all" on public.messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
