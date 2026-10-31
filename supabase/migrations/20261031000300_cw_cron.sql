-- Shared secret between pg_cron and the cw-monthly-billing edge function.
-- Stored once in Vault; the function reads it through cw_get_cron_secret() with the service role.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cw_cron_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cw_cron_secret', 'Header value for x-cw-cron-secret on cw-monthly-billing');
  end if;
end $$;

create or replace function public.cw_get_cron_secret()
returns text
language sql stable security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cw_cron_secret' limit 1;
$$;
revoke execute on function public.cw_get_cron_secret() from public, anon, authenticated;
grant execute on function public.cw_get_cron_secret() to service_role;

-- Monthly billing on the 28th at 09:00 PKT (04:00 UTC) and a daily overdue marker.
select cron.unschedule(jobid) from cron.job where jobname in ('cw-monthly-billing', 'cw-mark-overdue');

select cron.schedule(
  'cw-monthly-billing',
  '0 4 28 * *',
  $$
  select net.http_post(
    url := 'https://aliegtwlfphpeyvesyvi.supabase.co/functions/v1/cw-monthly-billing',
    body := '{"source":"pg_cron"}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cw-cron-secret', public.cw_get_cron_secret()
    ),
    timeout_milliseconds := 120000
  );
  $$
);

select cron.schedule(
  'cw-mark-overdue',
  '30 4 * * *',
  $$ update public.cw_invoices set status = 'overdue' where status = 'sent' and due_date < current_date; $$
);
