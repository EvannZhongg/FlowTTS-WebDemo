-- FlowTTS WebDemo Supabase initialization.
-- Run in the target Supabase project's SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.user_profile (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    email text,
    company text,
    daily_request_count integer not null default 0,
    last_request_at timestamptz,
    daily_quota integer not null default 10000 check (daily_quota >= 0),
    used_quota integer not null default 0 check (used_quota >= 0),
    last_reset_date date not null default current_date,
    subscription_tier varchar(20) not null default 'free',
    subscription_start timestamptz,
    subscription_end timestamptz,
    auto_renew boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.cloned_voices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    voice_id varchar(100) not null unique,
    voice_name varchar(100),
    model varchar(50),
    description text,
    audio_duration numeric,
    audio_url text,
    audio_size integer,
    usage_count integer not null default 0,
    last_used_at timestamptz,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint cloned_voices_model_check check (
        model is null
        or model in ('flow_01_turbo', 'flow_02_turbo', 'flow_01_ex')
    )
);

create index if not exists cloned_voices_user_active_created_idx
    on public.cloned_voices (user_id, is_active, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists user_profile_set_updated_at on public.user_profile;
create trigger user_profile_set_updated_at
before update on public.user_profile
for each row execute function public.set_updated_at();

drop trigger if exists cloned_voices_set_updated_at on public.cloned_voices;
create trigger cloned_voices_set_updated_at
before update on public.cloned_voices
for each row execute function public.set_updated_at();

create or replace function public.increment_voice_usage(
    voice_id_param varchar,
    user_id_param uuid
)
returns public.cloned_voices
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_voice public.cloned_voices;
begin
    update public.cloned_voices
    set usage_count = usage_count + 1,
        last_used_at = now()
    where voice_id = voice_id_param
      and user_id = user_id_param
      and is_active = true
    returning * into updated_voice;

    return updated_voice;
end;
$$;

alter table public.user_profile enable row level security;
alter table public.cloned_voices enable row level security;

drop policy if exists user_profile_select_own on public.user_profile;
create policy user_profile_select_own
on public.user_profile for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_profile_update_own on public.user_profile;
create policy user_profile_update_own
on public.user_profile for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists cloned_voices_select_own on public.cloned_voices;
create policy cloned_voices_select_own
on public.cloned_voices for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists cloned_voices_update_own on public.cloned_voices;
create policy cloned_voices_update_own
on public.cloned_voices for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, update on public.user_profile to authenticated;
grant select, update on public.cloned_voices to authenticated;
grant execute on function public.increment_voice_usage(varchar, uuid) to authenticated;

-- The backend uses the Supabase Secret Key, whose Postgres role is service_role.
grant usage on schema public to service_role;
grant all privileges on public.user_profile to service_role;
grant all privileges on public.cloned_voices to service_role;
grant execute on function public.increment_voice_usage(varchar, uuid) to service_role;

notify pgrst, 'reload schema';
