begin;
alter table public.partner_registrations add column profile_edit_pending boolean not null default false;
create table public.partner_profile_edits (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.partner_registrations(id),
  actor_id uuid not null,
  completed_by uuid,
  before_values jsonb not null,
  after_values jsonb not null,
  was_enabled boolean not null,
  state text not null default 'pending' check (state in ('pending','complete','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index partner_profile_edit_pending on public.partner_profile_edits(registration_id) where state='pending';
alter table public.partner_profile_edits enable row level security;
revoke all on public.partner_profile_edits from public, anon, authenticated;

create function public.partner_portal_session_valid()
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    join public.partner_registrations r on r.user_id=u.id
    where u.id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
      and lower(u.email)=lower((select auth.jwt()->>'email')) and lower(u.email)=r.email
      and r.ready and not r.disabled and not r.profile_edit_pending and r.deleted_at is null
      and not coalesce(u.banned_until>now(),false)
  );
$$;
revoke all on function public.partner_portal_session_valid() from public, anon;
grant execute on function public.partner_portal_session_valid() to authenticated;
alter policy "Users can read their own partner membership" on public.partner_memberships
  using ((select auth.uid())=user_id and enabled and (select public.partner_portal_session_valid()));
create or replace function public.get_partner_display_profile()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',r.partner_id,'name',r.company)
  from public.partner_registrations r join public.partner_memberships m on m.user_id=r.user_id and m.partner_id=r.partner_id
  where r.user_id=(select auth.uid()) and m.enabled and r.ready and not r.disabled and not r.profile_edit_pending and r.deleted_at is null
    and (select public.partner_portal_session_valid()) limit 1;
$$;

-- Called only while the administrator owns the registration lease. No email/password values are supplied to session invalidation.
create function public.invalidate_partner_credentials(p_id uuid,p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
  select user_id into target from public.partner_registrations where id=p_id and lock_token=p_token and locked_until>now() and profile_edit_pending for update;
  if target is null then raise exception 'Partner edit lease required'; end if;
  delete from auth.refresh_tokens where user_id=target::text;
  delete from auth.sessions where user_id=target;
  update auth.users set confirmation_token='',recovery_token='',email_change='',email_change_token_new='',email_change_token_current='',email_change_confirm_status=0,reauthentication_token='' where id=target;
end;
$$;

create function public.prepare_partner_profile_edit(p_id uuid,p_token uuid,p_actor uuid,p_company text,p_name text,p_email text,p_expected jsonb,p_confirm_email boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.partner_registrations%rowtype; op public.partner_profile_edits%rowtype; target jsonb; enabled_before boolean;
begin
  select * into r from public.partner_registrations where id=p_id and lock_token=p_token and locked_until>now() for update;
  if not found or r.deleted_at is not null or not r.ready or r.user_id is null or r.partner_id is null then raise exception 'Complete partner setup before editing'; end if;
  if length(trim(p_company)) not between 1 and 160 or length(trim(p_name)) not between 1 and 120 or p_email<>lower(trim(p_email)) or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid profile values'; end if;
  target:=jsonb_build_object('company',trim(p_company),'name',trim(p_name),'email',p_email);
  select * into op from public.partner_profile_edits where registration_id=p_id and state='pending';
  if found then
    if op.after_values<>target then raise exception 'Resume the pending update before changing its values'; end if;
  else
    if p_expected<>jsonb_build_object('company',r.company,'name',r.name,'email',r.email) then raise exception 'Partner details changed; refresh before editing'; end if;
    if exists(select 1 from auth.users where lower(email)=p_email and id<>r.user_id) then raise unique_violation using message='Email already registered'; end if;
    select enabled into enabled_before from public.partner_memberships where user_id=r.user_id and partner_id=r.partner_id;
    insert into public.partner_profile_edits(registration_id,actor_id,before_values,after_values,was_enabled)
      values(p_id,p_actor,jsonb_build_object('company',r.company,'name',r.name,'email',r.email),target,coalesce(enabled_before,false)) returning * into op;
    update public.partner_registrations set company=trim(p_company),name=trim(p_name),email=p_email,profile_edit_pending=true where id=p_id;
    update public.partner_memberships set enabled=false where user_id=r.user_id;
  end if;
  if op.before_values->>'email'<>op.after_values->>'email' then
    if not coalesce(p_confirm_email,false) then raise exception 'Confirm the email belongs to the same contact'; end if;
    perform public.invalidate_partner_credentials(p_id,p_token);
  end if;
  return jsonb_build_object('id',op.id,'before',op.before_values,'after',op.after_values);
end;
$$;

create function public.finish_partner_profile_edit(p_id uuid,p_token uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.partner_registrations%rowtype; op public.partner_profile_edits%rowtype;
begin
  select * into r from public.partner_registrations where id=p_id and lock_token=p_token and locked_until>now() and profile_edit_pending for update;
  if not found then return false; end if;
  select * into op from public.partner_profile_edits where registration_id=p_id and state='pending' for update;
  if not found or not exists(select 1 from auth.users u where u.id=r.user_id and lower(u.email)=r.email and u.raw_user_meta_data->>'full_name'=r.name) then raise exception 'Auth and profile are not aligned'; end if;
  if op.before_values->>'email'<>op.after_values->>'email' then perform public.invalidate_partner_credentials(p_id,p_token); end if;
  update public.partner_registrations set profile_edit_pending=false where id=p_id;
  update public.partner_memberships set enabled=op.was_enabled and not r.disabled and not exists(select 1 from auth.users where id=r.user_id and banned_until>now()) where user_id=r.user_id and partner_id=r.partner_id;
  update public.partner_profile_edits set state='complete',completed_by=p_actor,completed_at=now() where id=op.id;
  perform public.enqueue_partner_airtable_sync(p_id);
  return true;
end;
$$;

create function public.cancel_partner_profile_edit(p_id uuid,p_token uuid,p_actor uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare r public.partner_registrations%rowtype; op public.partner_profile_edits%rowtype;
begin
  select * into r from public.partner_registrations where id=p_id and lock_token=p_token and locked_until>now() and profile_edit_pending for update;
  if not found then return false; end if;
  select * into op from public.partner_profile_edits where registration_id=p_id and state='pending' for update;
  if not found or not exists(select 1 from auth.users where id=r.user_id and lower(email)=op.before_values->>'email') then return false; end if;
  update public.partner_registrations set company=op.before_values->>'company',name=op.before_values->>'name',email=op.before_values->>'email',profile_edit_pending=false where id=p_id;
  update public.partner_memberships set enabled=op.was_enabled and not r.disabled where user_id=r.user_id and partner_id=r.partner_id;
  update public.partner_profile_edits set state='cancelled',completed_by=p_actor,completed_at=now() where id=op.id;
  perform public.enqueue_partner_airtable_sync(p_id);
  return true;
end;
$$;

revoke all on function public.invalidate_partner_credentials(uuid,uuid) from public,anon,authenticated;
revoke all on function public.prepare_partner_profile_edit(uuid,uuid,uuid,text,text,text,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.finish_partner_profile_edit(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.cancel_partner_profile_edit(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_partner_profile_edit(uuid,uuid,uuid,text,text,text,jsonb,boolean) to service_role;
grant execute on function public.finish_partner_profile_edit(uuid,uuid,uuid) to service_role;
grant execute on function public.cancel_partner_profile_edit(uuid,uuid,uuid) to service_role;

-- Extend the admin view without exposing internal operation/session tokens.
drop function public.list_partner_admin_accounts();
create function public.list_partner_admin_accounts()
returns table(id uuid,company text,name text,email text,user_id uuid,partner_id text,ready boolean,activated boolean,created_at timestamptz,disabled boolean,deleted_at timestamptz,profile_edit_pending boolean,previous_email text)
language sql stable security definer set search_path='' as $$
  select r.id,r.company,r.name,r.email,r.user_id,r.partner_id,r.ready,
    coalesce(u.email_confirmed_at is not null and length(u.encrypted_password)>0,false),r.created_at,
    r.disabled or coalesce(u.banned_until>now(),false),r.deleted_at,r.profile_edit_pending,op.before_values->>'email'
  from public.partner_registrations r left join auth.users u on u.id=r.user_id
  left join public.partner_profile_edits op on op.registration_id=r.id and op.state='pending'
  where r.deleted_at is null order by r.created_at desc;
$$;
revoke all on function public.list_partner_admin_accounts() from public,anon,authenticated;
grant execute on function public.list_partner_admin_accounts() to service_role;
create or replace function public.partner_airtable_snapshots(p_ids uuid[])
returns table (id uuid,company text,name text,email text,user_id uuid,partner_id text,account_status text,created_at timestamptz,deleted_at timestamptz)
language sql stable security definer set search_path='' as $$
  select r.id,r.company,r.name,r.email,r.user_id,r.partner_id,
    case when r.deleted_at is not null then 'Deleted'
      when r.profile_edit_pending or r.disabled or coalesce(u.banned_until>now(),false) then 'Deactivated'
      when u.email_confirmed_at is not null and coalesce(length(u.encrypted_password),0)>0 then 'Active'
      when r.ready then 'Awaiting activation' else 'Setup incomplete' end,
    r.created_at,r.deleted_at
  from public.partner_registrations r left join auth.users u on u.id=r.user_id where r.id=any(p_ids);
$$;
commit;
