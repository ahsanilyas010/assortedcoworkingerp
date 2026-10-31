-- Monthly billing on the 28th at 09:00 PKT (04:00 UTC) and a daily overdue marker.
-- The cron secret is stored in Vault as 'cw_cron_secret' and must match the
-- CW_CRON_SECRET edge function secret.
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
      'x-cw-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cw_cron_secret' limit 1)
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
