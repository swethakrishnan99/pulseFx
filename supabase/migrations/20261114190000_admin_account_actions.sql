begin;
create table public.admin_account_action_lease (
  singleton boolean primary key default true check(singleton),
  token uuid, actor_id uuid, expires_at timestamptz
);
insert into public.admin_account_action_lease(singleton) values(true);
alter table public.admin_account_action_lease enable row level security;
revoke all on public.admin_account_action_lease from public,anon,authenticated;

create function public.claim_admin_account_action(p_actor uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.admin_account_action_lease set token=p_token,actor_id=p_actor,expires_at=now()+interval '5 minutes'
    where singleton and (expires_at is null or expires_at<now());
  if not found then return false; end if;
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role'='partner_admin'
    and deleted_at is null and not coalesce(banned_until>now(),false)) then
    raise exception 'Active administrator required';
  end if;
  return true;
end;
$$;
create function public.release_admin_account_action(p_token uuid)
returns void language sql security definer set search_path='' as $$
  update public.admin_account_action_lease set token=null,actor_id=null,expires_at=null where singleton and token=p_token;
$$;
create function public.invalidate_admin_credentials(p_id uuid,p_token uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.admin_account_action_lease where singleton and token=p_token and expires_at>now()) then
    raise exception 'Administrator action lease required';
  end if;
  if not exists(select 1 from auth.users where id=p_id and raw_app_meta_data->>'role'='partner_admin') then
    raise exception 'Administrator target required';
  end if;
  delete from auth.refresh_tokens where user_id=p_id::text;
  delete from auth.sessions where user_id=p_id;
  update auth.users set confirmation_token='',recovery_token='',email_change='',email_change_token_new='',email_change_token_current='',email_change_confirm_status=0,reauthentication_token='' where id=p_id;
end;
$$;
-- Enforce the last-active-admin rule even across concurrent Auth API calls.
create function public.protect_last_portal_admin()
returns trigger language plpgsql security definer set search_path='' as $$
declare removes_access boolean;
begin
  if old.raw_app_meta_data->>'role' is distinct from 'partner_admin' or old.deleted_at is not null
    or coalesce(old.banned_until>now(),false) or old.email_confirmed_at is null
    or coalesce(length(old.encrypted_password),0)=0 then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='DELETE' then removes_access:=true;
  else removes_access:=new.raw_app_meta_data->>'role' is distinct from 'partner_admin'
    or new.deleted_at is not null or coalesce(new.banned_until>now(),false)
    or new.email_confirmed_at is null or coalesce(length(new.encrypted_password),0)=0;
  end if;
  if removes_access then
    perform pg_advisory_xact_lock(76114190000);
    if not exists(select 1 from auth.users u where u.id<>old.id and u.raw_app_meta_data->>'role'='partner_admin'
      and u.deleted_at is null and not coalesce(u.banned_until>now(),false)
      and u.email_confirmed_at is not null and coalesce(length(u.encrypted_password),0)>0) then
      raise exception 'The last active administrator cannot be removed or deactivated';
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger protect_last_portal_admin before update or delete on auth.users
  for each row execute function public.protect_last_portal_admin();

-- Check live sessions for admin endpoints, including after an email change.
create function public.portal_admin_session_valid(p_user_id uuid,p_session_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
    where u.id=p_user_id and s.id=p_session_id and u.raw_app_meta_data->>'role'='partner_admin'
      and u.deleted_at is null and not coalesce(u.banned_until>now(),false));
$$;
revoke all on function public.claim_admin_account_action(uuid,uuid),public.release_admin_account_action(uuid),public.invalidate_admin_credentials(uuid,uuid),public.portal_admin_session_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_admin_account_action(uuid,uuid),public.release_admin_account_action(uuid),public.invalidate_admin_credentials(uuid,uuid),public.portal_admin_session_valid(uuid,uuid) to service_role;
revoke all on function public.protect_last_portal_admin() from public,anon,authenticated;
commit;
