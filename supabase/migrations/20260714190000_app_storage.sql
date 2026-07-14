create table if not exists public.app_storage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_storage_user_key unique (user_id, key)
);

create index if not exists app_storage_user_id_idx on public.app_storage(user_id);

alter table public.app_storage enable row level security;

drop policy if exists "Users read own storage" on public.app_storage;
drop policy if exists "Users insert own storage" on public.app_storage;
drop policy if exists "Users update own storage" on public.app_storage;
drop policy if exists "Users delete own storage" on public.app_storage;

create policy "Users read own storage"
  on public.app_storage for select
  using (auth.uid() = user_id);

create policy "Users insert own storage"
  on public.app_storage for insert
  with check (auth.uid() = user_id);

create policy "Users update own storage"
  on public.app_storage for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own storage"
  on public.app_storage for delete
  using (auth.uid() = user_id);