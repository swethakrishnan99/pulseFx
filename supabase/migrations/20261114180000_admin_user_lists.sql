begin;
-- Only the service-role function handler may read Auth account summaries.
create function public.list_portal_administrators()
returns table(id uuid,name text,email text,created_at timestamptz,activated boolean,disabled boolean)
language sql stable security definer set search_path='' as $$
  select u.id,coalesce(u.raw_user_meta_data->>'full_name',''),u.email::text,u.created_at,
    coalesce(u.email_confirmed_at is not null and length(u.encrypted_password)>0,false),
    coalesce(u.banned_until>now(),false)
  from auth.users u where u.raw_app_meta_data->>'role'='partner_admin' and u.deleted_at is null
  order by u.created_at desc,u.id;
$$;
revoke all on function public.list_portal_administrators() from public,anon,authenticated;
grant execute on function public.list_portal_administrators() to service_role;

drop function public.list_partner_admin_accounts();
create function public.list_partner_admin_accounts()
returns table(id uuid,company text,name text,email text,user_id uuid,partner_id text,ready boolean,activated boolean,created_at timestamptz,disabled boolean,deleted_at timestamptz,profile_edit_pending boolean,previous_email text,user_created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select r.id,r.company,r.name,r.email,r.user_id,r.partner_id,r.ready,
    coalesce(u.email_confirmed_at is not null and length(u.encrypted_password)>0,false),r.created_at,
    r.disabled or coalesce(u.banned_until>now(),false),r.deleted_at,r.profile_edit_pending,op.before_values->>'email',u.created_at
  from public.partner_registrations r left join auth.users u on u.id=r.user_id
  left join public.partner_profile_edits op on op.registration_id=r.id and op.state='pending'
  where r.deleted_at is null order by r.created_at desc;
$$;
revoke all on function public.list_partner_admin_accounts() from public,anon,authenticated;
grant execute on function public.list_partner_admin_accounts() to service_role;
commit;
