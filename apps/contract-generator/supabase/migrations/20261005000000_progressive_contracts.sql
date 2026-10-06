-- F2.0A: permite a persistência progressiva do contrato sem antecipar os fluxos F2.
-- A tabela estava vazia após a F1.3; por isso o novo campo obrigatório pode ser
-- adicionado sem valor artificial para registros existentes.
do $$
begin
  if exists (select 1 from public.contracts) then
    raise exception 'F2.0A requires public.contracts to be empty because fill_flow cannot be inferred safely';
  end if;
end
$$;

alter table public.contracts
  add column fill_flow text not null
    check (fill_flow in ('Solicitar dados ao cliente', 'Preencher manualmente'));

alter table public.contracts
  alter column client_full_name drop not null,
  alter column client_person_type drop not null,
  alter column client_document_number drop not null,
  alter column client_email drop not null,
  alter column client_address_street drop not null,
  alter column client_address_number drop not null,
  alter column client_address_neighborhood drop not null,
  alter column client_postal_code drop not null,
  alter column client_city drop not null,
  alter column client_state drop not null,
  alter column client_phone drop not null,
  alter column product_model drop not null,
  alter column product_capacity drop not null,
  alter column product_condition drop not null,
  alter column product_color drop not null,
  alter column negotiation_total_amount drop not null,
  alter column negotiation_entry_amount drop not null,
  alter column negotiation_commitment_deposit_amount drop not null,
  alter column negotiation_trade_in_included drop not null,
  alter column negotiation_delivery_days drop not null;

alter table public.contracts
  drop constraint contracts_trade_in_value_check;

alter table public.contracts
  add constraint contracts_trade_in_value_check check (
    (negotiation_trade_in_included is null and negotiation_trade_in_value is null)
    or (
      negotiation_trade_in_included = true
      and negotiation_trade_in_value is not null
    )
    or (
      negotiation_trade_in_included = false
      and negotiation_trade_in_value is null
    )
  );
