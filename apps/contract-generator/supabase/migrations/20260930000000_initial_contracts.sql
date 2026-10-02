-- F1.3: fonte de dados do contrato V1. Rollback controlado: DROP TABLE public.contracts.
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('Aguardando cliente', 'Pendente', 'Pronto', 'Gerado')),
  client_full_name text not null,
  client_person_type text not null check (client_person_type in ('PF', 'PJ')),
  client_document_number text not null,
  client_email text not null,
  client_address_street text not null,
  client_address_number text not null,
  client_address_neighborhood text not null,
  client_address_complement text,
  client_postal_code text not null,
  client_city text not null,
  client_state text not null,
  client_phone text not null,
  product_model text not null,
  product_capacity text not null,
  product_condition text not null check (product_condition in ('NOVO', 'SEMINOVO')),
  product_color text not null,
  negotiation_total_amount numeric not null,
  negotiation_entry_amount numeric not null,
  negotiation_commitment_deposit_amount numeric not null,
  negotiation_trade_in_included boolean not null,
  negotiation_trade_in_value numeric,
  negotiation_delivery_days integer not null,
  created_at timestamptz not null default now(),
  constraint contracts_trade_in_value_check check (
    (negotiation_trade_in_included and negotiation_trade_in_value is not null)
    or (not negotiation_trade_in_included and negotiation_trade_in_value is null)
  )
);

alter table public.contracts enable row level security;
revoke all on table public.contracts from public, anon, authenticated;
