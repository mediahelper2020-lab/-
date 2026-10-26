-- =====================================================================
-- 클로드복지관 PPP 평생과정설계 웹앱 — Supabase 스키마 + RLS
-- 실행: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여넣기 → Run
--       (또는 Supabase CLI: supabase db push)
-- 원칙: 모든 테이블 RLS 켬, 비로그인(anon) 접근 전면 차단,
--       같은 기관(org) 안에서도 역할별로 보기/수정 범위를 나눔.
-- 역할: admin(기관 관리자) / manager(팀장) / worker(담당자) / viewer(열람) / pending(승인 대기)
-- =====================================================================

-- 내부 함수 전용 스키마 (API로 노출되지 않음)
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- 1. 테이블
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  org_id       uuid references public.organizations (id) on delete set null,
  role         text not null default 'pending'
               check (role in ('admin', 'manager', 'worker', 'viewer', 'pending')),
  display_name text not null default '' check (char_length(display_name) <= 30),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists profiles_org_idx on public.profiles (org_id);

-- 참여자 1명 = 1행. 서식·진행과정·평가·일정은 data(jsonb)에 앱의 Case 구조 그대로 저장
create table if not exists public.cases (
  id          text primary key check (id ~ '^[a-z0-9]{4,32}$'),
  org_id      uuid not null references public.organizations (id) on delete restrict,
  label       text not null check (char_length(label) between 1 and 30),
  status      text not null default '진행중' check (status in ('진행중', '보류', '종결', '자조활동 연계')),
  assigned_to uuid references public.profiles (id) on delete set null,
  is_sample   boolean not null default false,
  data        jsonb not null default '{}'::jsonb
              check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 2000000),
  version     integer not null default 1,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index if not exists cases_org_idx on public.cases (org_id);
create index if not exists cases_assigned_idx on public.cases (assigned_to);

-- 접근 기록: 내용(개인정보)은 남기지 않고 누가·언제·무엇을 했는지만 기록
create table if not exists public.audit_logs (
  id      bigint generated always as identity primary key,
  org_id  uuid,
  user_id uuid,
  case_id text,
  action  text not null,
  at      timestamptz not null default now()
);
create index if not exists audit_org_at_idx on public.audit_logs (org_id, at desc);

-- ---------------------------------------------------------------------
-- 2. 내부 함수 (RLS 정책에서 사용, 재귀 방지를 위해 security definer)
-- ---------------------------------------------------------------------
create or replace function private.my_org_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select org_id from public.profiles where id = (select auth.uid()) $$;

create or replace function private.my_role() returns text
language sql stable security definer set search_path = ''
as $$ select coalesce((select role from public.profiles where id = (select auth.uid())), 'pending') $$;

revoke all on function private.my_org_id() from public, anon;
revoke all on function private.my_role() from public, anon;
grant execute on function private.my_org_id() to authenticated;
grant execute on function private.my_role() to authenticated;

-- ---------------------------------------------------------------------
-- 3. 트리거
-- ---------------------------------------------------------------------
-- 가입 시 프로필 자동 생성 (역할 pending: 관리자가 승인해야 아무것도 볼 수 있음)
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 30))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- 프로필 보호: 본인은 이름만 수정 가능, 역할·기관 변경은 같은 기관 관리자만
create or replace function private.guard_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare r text := private.my_role();
begin
  if (select auth.uid()) is null then return new; end if; -- 대시보드·서비스 키(SQL Editor) 작업
  new.id := old.id; new.created_at := old.created_at; new.updated_at := now();
  if new.role is distinct from old.role or new.org_id is distinct from old.org_id then
    -- 소속 없는 사용자(old.org_id null)는 RLS상 직접 수정 불가, add_member 함수로만 추가됨
    if r <> 'admin' or (old.org_id is not null and old.org_id is distinct from private.my_org_id()) then
      raise exception '권한이 없습니다: 역할·기관은 관리자만 바꿀 수 있습니다.' using errcode = '42501';
    end if;
    if old.id = (select auth.uid()) then
      raise exception '본인의 역할·기관은 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    if new.org_id is not null and new.org_id <> private.my_org_id() then
      raise exception '다른 기관으로 옮길 수 없습니다.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function private.guard_profile();

-- 참여자 기록 보호: 기관·작성자 위조 차단, 버전 증가(동시 수정 충돌 감지)
create or replace function private.guard_case() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return new; end if;
  if tg_op = 'INSERT' then
    new.org_id := private.my_org_id();
    new.created_by := uid; new.created_at := now(); new.version := 1;
    if new.assigned_to is null then new.assigned_to := uid; end if;
  else
    new.org_id := old.org_id; new.created_by := old.created_by; new.created_at := old.created_at;
    new.version := old.version + 1;
  end if;
  -- 담당자는 같은 기관의 승인된 직원만 지정 가능
  if new.assigned_to is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.assigned_to and p.org_id = new.org_id and p.role in ('admin', 'manager', 'worker')
  ) then
    raise exception '담당자는 같은 기관 직원만 지정할 수 있습니다.' using errcode = '42501';
  end if;
  new.updated_by := uid; new.updated_at := now();
  return new;
end $$;
drop trigger if exists guard_case on public.cases;
create trigger guard_case before insert or update on public.cases
  for each row execute function private.guard_case();

create or replace function private.log_case() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_logs (org_id, user_id, case_id, action)
  values (coalesce(new.org_id, old.org_id), (select auth.uid()), coalesce(new.id, old.id), lower(tg_op));
  return null;
end $$;
drop trigger if exists log_case on public.cases;
create trigger log_case after insert or update or delete on public.cases
  for each row execute function private.log_case();

revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.guard_profile() from public, anon, authenticated;
revoke all on function private.guard_case() from public, anon, authenticated;
revoke all on function private.log_case() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. RLS — 모든 테이블 켬
-- ---------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles      enable row level security;
alter table public.cases         enable row level security;
alter table public.audit_logs    enable row level security;

-- 비로그인 사용자 권한 전부 회수, 로그인 사용자도 필요한 동작만
revoke all on public.organizations, public.profiles, public.cases, public.audit_logs from anon, public;
revoke all on public.organizations, public.profiles, public.cases, public.audit_logs from authenticated;
grant select, update on public.organizations to authenticated;
grant select, update (display_name, role, org_id) on public.profiles to authenticated;
grant select, insert, update, delete on public.cases to authenticated;
grant select on public.audit_logs to authenticated;
revoke all on sequence public.audit_logs_id_seq from anon, authenticated, public;

-- organizations: 내 기관만 보기, 이름은 관리자만 수정
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (id = (select private.my_org_id()));
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
  using (id = (select private.my_org_id()) and (select private.my_role()) = 'admin')
  with check (id = (select private.my_org_id()));

-- profiles: 내 프로필 + (승인된 직원은) 같은 기관 직원 목록
drop policy if exists profile_select on public.profiles;
create policy profile_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (org_id = (select private.my_org_id()) and (select private.my_role()) <> 'pending')
  );
drop policy if exists profile_update on public.profiles;
create policy profile_update on public.profiles for update to authenticated
  using (
    id = (select auth.uid())
    or (org_id = (select private.my_org_id()) and (select private.my_role()) = 'admin')
  )
  with check (
    id = (select auth.uid())
    or ((select private.my_role()) = 'admin' and (org_id is null or org_id = (select private.my_org_id())))
  );

-- cases: 관리자·팀장·열람자는 기관 전체, 담당자는 본인 담당만
drop policy if exists case_select on public.cases;
create policy case_select on public.cases for select to authenticated
  using (
    org_id = (select private.my_org_id())
    and (
      (select private.my_role()) in ('admin', 'manager', 'viewer')
      or ((select private.my_role()) = 'worker' and assigned_to = (select auth.uid()))
    )
  );
drop policy if exists case_insert on public.cases;
create policy case_insert on public.cases for insert to authenticated
  with check (
    org_id = (select private.my_org_id())
    and (
      (select private.my_role()) in ('admin', 'manager')
      or ((select private.my_role()) = 'worker' and assigned_to = (select auth.uid()))
    )
  );
drop policy if exists case_update on public.cases;
create policy case_update on public.cases for update to authenticated
  using (
    org_id = (select private.my_org_id())
    and (
      (select private.my_role()) in ('admin', 'manager')
      or ((select private.my_role()) = 'worker' and assigned_to = (select auth.uid()))
    )
  )
  with check (
    org_id = (select private.my_org_id())
    and (
      (select private.my_role()) in ('admin', 'manager')
      or ((select private.my_role()) = 'worker' and assigned_to = (select auth.uid()))
    )
  );
drop policy if exists case_delete on public.cases;
create policy case_delete on public.cases for delete to authenticated
  using (org_id = (select private.my_org_id()) and (select private.my_role()) = 'admin');

-- audit_logs: 관리자만 열람, 쓰기는 트리거만 (insert/update/delete 정책 없음 = 차단)
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (org_id = (select private.my_org_id()) and (select private.my_role()) = 'admin');

-- ---------------------------------------------------------------------
-- 5. 관리자용 함수 (앱의 [직원 관리]에서 호출)
-- ---------------------------------------------------------------------
-- 가입한 직원(이메일)을 내 기관에 추가하고 역할 지정
create or replace function public.add_member(member_email text, member_role text)
returns void language plpgsql security definer set search_path = ''
as $$
declare target uuid;
begin
  if private.my_role() <> 'admin' then
    raise exception '관리자만 직원을 추가할 수 있습니다.' using errcode = '42501';
  end if;
  if member_role not in ('manager', 'worker', 'viewer') then
    raise exception '역할은 manager, worker, viewer 중 하나여야 합니다.' using errcode = '22023';
  end if;
  select u.id into target from auth.users u where lower(u.email) = lower(trim(member_email));
  if target is null then
    raise exception '해당 이메일로 가입한 사용자가 없습니다. 먼저 초대(가입)해 주세요.' using errcode = 'P0002';
  end if;
  update public.profiles set org_id = private.my_org_id(), role = member_role, updated_at = now()
  where id = target and (org_id is null or org_id = private.my_org_id()) and id <> (select auth.uid());
  if not found then
    raise exception '이미 다른 기관에 소속된 사용자이거나 본인입니다.' using errcode = '42501';
  end if;
end $$;
revoke all on function public.add_member(text, text) from public, anon;
grant execute on function public.add_member(text, text) to authenticated;
