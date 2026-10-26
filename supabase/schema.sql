-- 평생과정설계 웹앱 저장 테이블 (Supabase > SQL Editor 에 붙여넣고 Run)
-- 로그인한 사람마다 한 줄에 전체 작성 기록(JSON)을 저장한다. 다른 사람의 기록은 읽거나 고칠 수 없다(RLS).
create table if not exists public.ppp_workspaces (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  saved_at   timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ppp_workspaces enable row level security;

drop policy if exists "ppp read own"   on public.ppp_workspaces;
drop policy if exists "ppp insert own" on public.ppp_workspaces;
drop policy if exists "ppp update own" on public.ppp_workspaces;
drop policy if exists "ppp delete own" on public.ppp_workspaces;

create policy "ppp read own"   on public.ppp_workspaces for select using (auth.uid() = user_id);
create policy "ppp insert own" on public.ppp_workspaces for insert with check (auth.uid() = user_id);
create policy "ppp update own" on public.ppp_workspaces for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "ppp delete own" on public.ppp_workspaces for delete using (auth.uid() = user_id);
