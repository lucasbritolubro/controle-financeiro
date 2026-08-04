-- Acesso somente-leitura à campanha 2026 para usuários com papel campanha_viewer.
-- app_metadata esperada:
--   role: "campanha_viewer"
--   share_from_user_id: "<uuid do dono, ex. lucasbrito>"

create or replace function public.get_shared_campanha()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_src uuid;
  v_val jsonb;
begin
  v_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
  if v_role is distinct from 'campanha_viewer' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  begin
    v_src := nullif(auth.jwt() -> 'app_metadata' ->> 'share_from_user_id', '')::uuid;
  exception when others then
    v_src := null;
  end;

  if v_src is null then
    raise exception 'missing share_from_user_id' using errcode = '22023';
  end if;

  select s.value into v_val
  from public.app_storage s
  where s.user_id = v_src
    and s.key = 'painel-financeiro:campanha-2026'
  limit 1;

  return v_val; -- null se o dono ainda não salvou
end;
$$;

revoke all on function public.get_shared_campanha() from public;
grant execute on function public.get_shared_campanha() to authenticated;

-- Política extra: viewer pode SELECT a linha da campanha do dono (fallback sem RPC)
drop policy if exists "Campanha viewers read shared campanha" on public.app_storage;
create policy "Campanha viewers read shared campanha"
  on public.app_storage
  for select
  using (
    key = 'painel-financeiro:campanha-2026'
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'campanha_viewer'
    and user_id = nullif(auth.jwt() -> 'app_metadata' ->> 'share_from_user_id', '')::uuid
  );
