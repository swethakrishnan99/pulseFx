-- Create a membership for every Auth user who does not have one.
-- Use the user's UUID as a provisional partner ID.
-- Replace provisional partner IDs with the corresponding Airtable Partner IDs later.
insert into public.partner_memberships (user_id, partner_id)
select u.id, u.id::text
from auth.users u
where not exists (
  select 1
  from public.partner_memberships p
  where p.user_id = u.id
)
on conflict (user_id) do nothing
returning user_id, partner_id;
