-- F2.4: grava somente o cadastro autorizado e revoga o link na mesma transação.
create or replace function public.submit_public_contract_buyer_data(
  p_public_token text,
  p_client_full_name text,
  p_client_person_type text,
  p_client_document_number text,
  p_client_email text,
  p_client_address_street text,
  p_client_address_number text,
  p_client_address_neighborhood text,
  p_client_address_complement text,
  p_client_postal_code text,
  p_client_city text,
  p_client_state text,
  p_client_phone text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_document text := regexp_replace(coalesce(p_client_document_number, ''), '[^0-9]', '', 'g');
  normalized_postal_code text := regexp_replace(coalesce(p_client_postal_code, ''), '[^0-9]', '', 'g');
  normalized_phone text := regexp_replace(coalesce(p_client_phone, ''), '[^0-9]', '', 'g');
  validation_sum integer;
  validation_digit integer;
  validation_weight integer;
  position integer;
begin
  if p_public_token !~ '^[A-Za-z0-9_-]{43}$' then
    return false;
  end if;

  if p_client_person_type not in ('PF', 'PJ')
    or btrim(coalesce(p_client_full_name, '')) = ''
    or btrim(coalesce(p_client_email, '')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or btrim(coalesce(p_client_address_street, '')) = ''
    or btrim(coalesce(p_client_address_number, '')) = ''
    or btrim(coalesce(p_client_address_neighborhood, '')) = ''
    or btrim(coalesce(p_client_city, '')) = ''
    or upper(btrim(coalesce(p_client_state, ''))) !~ '^[A-Z]{2}$'
    or length(normalized_postal_code) <> 8
    or length(normalized_phone) not in (10, 11) then
    raise exception 'invalid buyer registration data' using errcode = '22023';
  end if;

  if p_client_person_type = 'PF' then
    if length(normalized_document) <> 11 or normalized_document ~ '^(.)\1+$' then
      raise exception 'invalid buyer registration data' using errcode = '22023';
    end if;

    validation_sum := 0;
    for position in 1..9 loop
      validation_sum := validation_sum + substr(normalized_document, position, 1)::integer * (11 - position);
    end loop;
    validation_digit := (validation_sum * 10) % 11;
    if validation_digit = 10 then validation_digit := 0; end if;
    if validation_digit <> substr(normalized_document, 10, 1)::integer then
      raise exception 'invalid buyer registration data' using errcode = '22023';
    end if;

    validation_sum := 0;
    for position in 1..10 loop
      validation_sum := validation_sum + substr(normalized_document, position, 1)::integer * (12 - position);
    end loop;
    validation_digit := (validation_sum * 10) % 11;
    if validation_digit = 10 then validation_digit := 0; end if;
    if validation_digit <> substr(normalized_document, 11, 1)::integer then
      raise exception 'invalid buyer registration data' using errcode = '22023';
    end if;
  else
    if length(normalized_document) <> 14 or normalized_document ~ '^(.)\1+$' then
      raise exception 'invalid buyer registration data' using errcode = '22023';
    end if;

    validation_sum := 0;
    for position in 1..12 loop
      validation_weight := case when position <= 4 then 6 - position else 14 - position end;
      validation_sum := validation_sum + substr(normalized_document, position, 1)::integer * validation_weight;
    end loop;
    validation_digit := case when validation_sum % 11 < 2 then 0 else 11 - (validation_sum % 11) end;
    if validation_digit <> substr(normalized_document, 13, 1)::integer then
      raise exception 'invalid buyer registration data' using errcode = '22023';
    end if;

    validation_sum := 0;
    for position in 1..13 loop
      validation_weight := case when position <= 5 then 7 - position else 15 - position end;
      validation_sum := validation_sum + substr(normalized_document, position, 1)::integer * validation_weight;
    end loop;
    validation_digit := case when validation_sum % 11 < 2 then 0 else 11 - (validation_sum % 11) end;
    if validation_digit <> substr(normalized_document, 14, 1)::integer then
      raise exception 'invalid buyer registration data' using errcode = '22023';
    end if;
  end if;

  update public.contracts
  set client_full_name = btrim(p_client_full_name),
      client_person_type = p_client_person_type,
      client_document_number = p_client_document_number,
      client_email = btrim(p_client_email),
      client_address_street = btrim(p_client_address_street),
      client_address_number = btrim(p_client_address_number),
      client_address_neighborhood = btrim(p_client_address_neighborhood),
      client_address_complement = nullif(btrim(coalesce(p_client_address_complement, '')), ''),
      client_postal_code = p_client_postal_code,
      client_city = btrim(p_client_city),
      client_state = upper(btrim(p_client_state)),
      client_phone = p_client_phone,
      public_link_token_hash = null,
      public_link_revoked_at = now()
  where fill_flow = 'Solicitar dados ao cliente'
    and public_link_revoked_at is null
    and public_link_token_hash = encode(extensions.digest(p_public_token, 'sha256'), 'hex');

  return found;
end;
$$;

create or replace function public.get_contract_buyer_registration(p_contract_id uuid)
returns table (
  client_full_name text,
  client_person_type text,
  client_document_number text,
  client_email text,
  client_address_street text,
  client_address_number text,
  client_address_neighborhood text,
  client_address_complement text,
  client_postal_code text,
  client_city text,
  client_state text,
  client_phone text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'internal' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    contracts.client_full_name,
    contracts.client_person_type,
    contracts.client_document_number,
    contracts.client_email,
    contracts.client_address_street,
    contracts.client_address_number,
    contracts.client_address_neighborhood,
    contracts.client_address_complement,
    contracts.client_postal_code,
    contracts.client_city,
    contracts.client_state,
    contracts.client_phone
  from public.contracts
  where contracts.id = p_contract_id;
end;
$$;

revoke all on function public.submit_public_contract_buyer_data(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_contract_buyer_registration(uuid) from public, anon, authenticated;

grant execute on function public.submit_public_contract_buyer_data(text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_contract_buyer_registration(uuid) to authenticated;
