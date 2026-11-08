begin;

create table public.partner_memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  partner_id text not null check (length(trim(partner_id)) > 0)
);

alter table public.partner_memberships enable row level security;

revoke all on table public.partner_memberships from public, anon, authenticated;
grant select on table public.partner_memberships to authenticated;

create policy "Users can read their own partner membership"
  on public.partner_memberships
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
