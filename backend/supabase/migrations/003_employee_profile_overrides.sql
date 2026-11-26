-- Run ONCE in Supabase SQL Editor. HR edits never change the original MDB.
-- Supabase source employees remain a faithful import; this overlay wins on reads.
create table if not exists public.attendpro_employee_profile_overrides (
  employee_id bigint primary key references public.attendpro_employees(id) on delete cascade,
  name text not null, department text not null, designation text not null,
  shift text not null, phone text not null default '', email text not null default '',
  updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create or replace function public.attendpro_profile_overrides_stamp()
returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
drop trigger if exists attendpro_profile_overrides_stamp on public.attendpro_employee_profile_overrides;
create trigger attendpro_profile_overrides_stamp before insert or update
  on public.attendpro_employee_profile_overrides
  for each row execute function public.attendpro_profile_overrides_stamp();
alter table public.attendpro_employee_profile_overrides enable row level security;
-- Access is ONLY through server-side secret key, behind FastAPI Super Admin authorization.
revoke all on public.attendpro_employee_profile_overrides from anon, authenticated;

grant select, insert, update, delete on public.attendpro_employee_profile_overrides to service_role;
