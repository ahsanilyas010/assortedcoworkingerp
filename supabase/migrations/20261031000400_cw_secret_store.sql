-- Server-side secret lookup for the cw-* edge functions (service role only).
-- Values live in Supabase Vault (WA_ACCESS_TOKEN, RESEND_API_KEY, optional RESEND_FROM)
-- and are created out of band, never committed. This function only exposes a fixed allowlist.
create or replace function public.cw_get_secret(p_name text)
returns text
language sql stable security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = p_name
    and p_name in ('WA_ACCESS_TOKEN', 'RESEND_API_KEY', 'RESEND_FROM')
  limit 1;
$$;
revoke execute on function public.cw_get_secret(text) from public, anon, authenticated;
grant execute on function public.cw_get_secret(text) to service_role;
