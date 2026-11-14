begin;
do $test$
declare first_token uuid:=gen_random_uuid(); next_token uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); duplicate_rejected boolean:=false;
begin
  if has_table_privilege('authenticated','public.payout_admin_operations','SELECT')
    or has_table_privilege('anon','public.payout_admin_operations','INSERT')
    or has_function_privilege('authenticated','public.claim_payout_admin_write(uuid)','EXECUTE') then raise exception 'Payout admin state exposed'; end if;
  if not public.claim_payout_admin_write(first_token) then raise exception 'Cannot acquire payout lease'; end if;
  if public.claim_payout_admin_write(next_token) then raise exception 'Concurrent writer allowed'; end if;
  if public.renew_payout_admin_write(next_token) then raise exception 'Wrong token renewed lease'; end if;
  perform public.release_payout_admin_write(next_token);
  if public.claim_payout_admin_write(next_token) then raise exception 'Wrong token released lease'; end if;
  if not public.renew_payout_admin_write(first_token) then raise exception 'Owner cannot renew'; end if;
  insert into public.payout_admin_operations(request_id,actor_id,action,input) values(request,actor,'create','{"ref":"test-only"}');
  begin insert into public.payout_admin_operations(request_id,actor_id,action,input) values(request,actor,'create','{}');
  exception when unique_violation then duplicate_rejected:=true; end;
  if not duplicate_rejected then raise exception 'Duplicate operation accepted'; end if;
  update public.payout_admin_operations set result='{"payout":{"id":"test-only"}}',completed_at=now() where request_id=request;
  if not exists(select 1 from public.payout_admin_operations where request_id=request and actor_id=actor and completed_at is not null) then raise exception 'Audit completion not recorded'; end if;
  perform public.release_payout_admin_write(first_token);
  if not public.claim_payout_admin_write(next_token) then raise exception 'Lease not released'; end if;
end;
$test$;
rollback;
