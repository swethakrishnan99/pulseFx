begin;

alter table public.partner_memberships add column enabled boolean not null default true;
alter table public.partner_registrations add column disabled boolean not null default false;
alter table public.partner_registrations add column deleted_at timestamptz;
alter table public.partner_registrations drop constraint partner_registrations_user_id_fkey;
alter table public.partner_registrations add constraint partner_registrations_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
grant update on public.partner_memberships to service_role;

alter policy "Users can read their own partner membership"
  on public.partner_memberships
  using ((select auth.uid()) = user_id and enabled);

-- Keep business records so deleting a login does not delete Airtable history.
-- A later registration with the same email can reuse the partner's Portal ID.
drop function public.list_partner_admin_accounts();
create function public.list_partner_admin_accounts()
returns table (id uuid, company text, name text, email text, user_id uuid,
  partner_id text, ready boolean, activated boolean, created_at timestamptz,
  disabled boolean, deleted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.company, r.name, r.email, r.user_id, r.partner_id, r.ready,
    coalesce(u.email_confirmed_at is not null and length(u.encrypted_password) > 0, false),
    r.created_at, r.disabled or coalesce(u.banned_until > now(), false), r.deleted_at
  from public.partner_registrations r
  left join auth.users u on u.id = r.user_id
  where r.deleted_at is null
  order by r.created_at desc;
$$;
revoke all on function public.list_partner_admin_accounts() from public, anon, authenticated;
grant execute on function public.list_partner_admin_accounts() to service_role;

-- Change the display state and data access together. Existing JWTs immediately
-- lose membership access through RLS, independently of Auth token expiry.
create function public.set_partner_account_access(p_id uuid, p_token uuid, p_enabled boolean)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  registration public.partner_registrations%rowtype;
begin
  if p_enabled is null then return false; end if;
  select * into registration from public.partner_registrations
    where id = p_id and lock_token = p_token and deleted_at is null for update;
  if not found then return false; end if;
  if p_enabled and (not registration.ready or registration.user_id is null or not exists (
    select 1 from public.partner_memberships m
    where m.user_id = registration.user_id and m.partner_id = registration.partner_id
  )) then
    raise exception 'Partner access must be provisioned before enabling';
  end if;
  update public.partner_registrations set disabled = not p_enabled where id = p_id;
  update public.partner_memberships set enabled = p_enabled
    where user_id = registration.user_id and partner_id = registration.partner_id;
  return true;
end;
$$;
revoke all on function public.set_partner_account_access(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_partner_account_access(uuid, uuid, boolean) to service_role;

commit;
