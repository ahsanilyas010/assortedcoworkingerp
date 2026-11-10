-- Invoice emails: default CC list, and an owner switch for sending automatically on the billing day.
alter table public.cw_tenants
  add column if not exists invoice_cc text[] not null default '{}',
  add column if not exists auto_send_invoices boolean not null default true;

comment on column public.cw_tenants.invoice_cc is 'Addresses copied (CC) on every invoice email';
comment on column public.cw_tenants.auto_send_invoices is 'true: the 28th run creates and sends invoices without approval; false: drafts wait for approval in the app';
