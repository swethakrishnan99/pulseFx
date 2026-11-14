begin;
do $$
declare
  partner text := 'rec' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 14);
  first_token uuid := gen_random_uuid();
  second_token uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
begin
  if not public.claim_banking_review(partner, first_token) then raise exception 'First claim failed'; end if;
  if public.claim_banking_review(partner, second_token) then raise exception 'Concurrent claim succeeded'; end if;
  if public.renew_banking_review(partner, second_token) then raise exception 'Wrong token renewed'; end if;
  if not public.renew_banking_review(partner, first_token) then raise exception 'Owner renew failed'; end if;
  if public.complete_banking_review(partner, second_token, 'rec00000000000001', 'approve', actor) then raise exception 'Wrong token completed'; end if;
  if not public.complete_banking_review(partner, first_token, 'rec00000000000001', 'approve', actor) then raise exception 'Complete failed'; end if;
  if not exists(select 1 from public.banking_review_events where partner_id = partner and actor_id = actor and action = 'approve') then raise exception 'Audit missing'; end if;
  if not public.claim_banking_review(partner, second_token) then raise exception 'Lock not released'; end if;
  perform public.release_banking_review(partner, first_token);
  if public.claim_banking_review(partner, first_token) then raise exception 'Wrong token released lock'; end if;
  if has_function_privilege('anon', 'public.claim_banking_review(text,uuid)', 'EXECUTE') then raise exception 'Anonymous execution allowed'; end if;
  if has_function_privilege('authenticated', 'public.complete_banking_review(text,uuid,text,text,uuid)', 'EXECUTE') then raise exception 'Partner execution allowed'; end if;
end;
$$;
rollback;
