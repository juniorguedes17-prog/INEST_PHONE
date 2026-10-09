-- F2.5: edição interna do cadastro sem tocar no link público ou em dados comerciais.
create or replace function public.update_contract_buyer_registration(
  p_contract_id uuid,
  p_expected jsonb,
  p_values jsonb
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_document text := regexp_replace(coalesce(p_values ->> 'documentNumber', ''), '[^0-9]', '', 'g');
  normalized_postal_code text := regexp_replace(coalesce(p_values ->> 'postalCode', ''), '[^0-9]', '', 'g');
  normalized_phone text := regexp_replace(coalesce(p_values ->> 'phone', ''), '[^0-9]', '', 'g');
  validation_sum integer;
  validation_digit integer;
  validation_weight integer;
  position integer;
  expected_keys text[] := array['fullName', 'personType', 'documentNumber', 'email', 'addressStreet', 'addressNumber', 'addressNeighborhood', 'addressComplement', 'postalCode', 'city', 'state', 'phone'];
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'internal' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if jsonb_typeof(p_expected) <> 'object'
    or (select count(*) from jsonb_object_keys(p_expected)) <> array_length(expected_keys, 1)
    or not p_expected ?& expected_keys
    or jsonb_typeof(p_values) <> 'object'
    or (select count(*) from jsonb_object_keys(p_values)) <> array_length(expected_keys, 1)
    or not p_values ?& expected_keys then
    raise exception 'invalid buyer registration data' using errcode = '22023';
  end if;

  if p_values ->> 'personType' not in ('PF', 'PJ')
    or btrim(coalesce(p_values ->> 'fullName', '')) = ''
    or btrim(coalesce(p_values ->> 'email', '')) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or btrim(coalesce(p_values ->> 'addressStreet', '')) = ''
    or btrim(coalesce(p_values ->> 'addressNumber', '')) = ''
    or btrim(coalesce(p_values ->> 'addressNeighborhood', '')) = ''
    or btrim(coalesce(p_values ->> 'city', '')) = ''
    or upper(btrim(coalesce(p_values ->> 'state', ''))) !~ '^[A-Z]{2}$'
    or length(normalized_postal_code) <> 8
    or length(normalized_phone) not in (10, 11) then
    raise exception 'invalid buyer registration data' using errcode = '22023';
  end if;

  if p_values ->> 'personType' = 'PF' then
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
  set client_full_name = btrim(p_values ->> 'fullName'),
      client_person_type = p_values ->> 'personType',
      client_document_number = p_values ->> 'documentNumber',
      client_email = btrim(p_values ->> 'email'),
      client_address_street = btrim(p_values ->> 'addressStreet'),
      client_address_number = btrim(p_values ->> 'addressNumber'),
      client_address_neighborhood = btrim(p_values ->> 'addressNeighborhood'),
      client_address_complement = nullif(btrim(coalesce(p_values ->> 'addressComplement', '')), ''),
      client_postal_code = p_values ->> 'postalCode',
      client_city = btrim(p_values ->> 'city'),
      client_state = upper(btrim(p_values ->> 'state')),
      client_phone = p_values ->> 'phone'
  where id = p_contract_id
    and (p_expected ->> 'fullName') is not distinct from client_full_name
    and (p_expected ->> 'personType') is not distinct from client_person_type
    and (p_expected ->> 'documentNumber') is not distinct from client_document_number
    and (p_expected ->> 'email') is not distinct from client_email
    and (p_expected ->> 'addressStreet') is not distinct from client_address_street
    and (p_expected ->> 'addressNumber') is not distinct from client_address_number
    and (p_expected ->> 'addressNeighborhood') is not distinct from client_address_neighborhood
    and (p_expected ->> 'addressComplement') is not distinct from client_address_complement
    and (p_expected ->> 'postalCode') is not distinct from client_postal_code
    and (p_expected ->> 'city') is not distinct from client_city
    and (p_expected ->> 'state') is not distinct from client_state
    and (p_expected ->> 'phone') is not distinct from client_phone;

  return case when found then 'updated' else 'conflict' end;
end;
$$;

revoke all on function public.update_contract_buyer_registration(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_contract_buyer_registration(uuid, jsonb, jsonb) to authenticated;
