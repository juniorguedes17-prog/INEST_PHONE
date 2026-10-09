-- F2.2: links públicos usam somente hashes e nunca concedem leitura pública de contracts.
create extension if not exists pgcrypto with schema extensions;

alter table public.contracts
  add column public_link_token_hash text,
  add column public_link_revoked_at timestamptz,
  add constraint contracts_public_link_token_hash_check check (
    public_link_token_hash is null
    or public_link_token_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint contracts_manual_fill_flow_has_no_public_link check (
    fill_flow = 'Solicitar dados ao cliente'
    or (public_link_token_hash is null and public_link_revoked_at is null)
  );

create unique index contracts_public_link_token_hash_unique
  on public.contracts (public_link_token_hash)
  where public_link_token_hash is not null;

create or replace function public.create_contract_with_public_link()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_contract_id uuid;
  new_public_token text;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'internal' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  new_public_token := translate(
    trim(trailing '=' from encode(extensions.gen_random_bytes(32), 'base64')),
    '+/',
    '-_'
  );

  insert into public.contracts (fill_flow, status, public_link_token_hash)
  values (
    'Solicitar dados ao cliente',
    'Aguardando cliente',
    encode(extensions.digest(new_public_token, 'sha256'), 'hex')
  )
  returning id into new_contract_id;

  return jsonb_build_object(
    'contract_id', new_contract_id,
    'public_token', new_public_token
  );
end;
$$;

create or replace function public.regenerate_contract_public_link(p_contract_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_public_token text;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'internal' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  new_public_token := translate(
    trim(trailing '=' from encode(extensions.gen_random_bytes(32), 'base64')),
    '+/',
    '-_'
  );

  update public.contracts
  set public_link_token_hash = encode(extensions.digest(new_public_token, 'sha256'), 'hex'),
      public_link_revoked_at = null
  where id = p_contract_id
    and fill_flow = 'Solicitar dados ao cliente';

  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return new_public_token;
end;
$$;

create or replace function public.revoke_contract_public_link(p_contract_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'internal' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.contracts
  set public_link_token_hash = null,
      public_link_revoked_at = now()
  where id = p_contract_id
    and fill_flow = 'Solicitar dados ao cliente'
    and public_link_token_hash is not null;

  return found;
end;
$$;

create or replace function public.resolve_public_contract_link(p_public_token text)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select case
    when p_public_token !~ '^[A-Za-z0-9_-]{43}$' then false
    else exists (
      select 1
      from public.contracts
      where fill_flow = 'Solicitar dados ao cliente'
        and public_link_revoked_at is null
        and public_link_token_hash = encode(extensions.digest(p_public_token, 'sha256'), 'hex')
    )
  end;
$$;

revoke all on function public.create_contract_with_public_link() from public, anon, authenticated;
revoke all on function public.regenerate_contract_public_link(uuid) from public, anon, authenticated;
revoke all on function public.revoke_contract_public_link(uuid) from public, anon, authenticated;
revoke all on function public.resolve_public_contract_link(text) from public, anon, authenticated;

grant execute on function public.create_contract_with_public_link() to authenticated;
grant execute on function public.regenerate_contract_public_link(uuid) to authenticated;
grant execute on function public.revoke_contract_public_link(uuid) to authenticated;
grant execute on function public.resolve_public_contract_link(text) to anon, authenticated;

-- F2.4 must call revoke_contract_public_link when a customer submission becomes final.
