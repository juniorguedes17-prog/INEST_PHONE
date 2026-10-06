-- F2.0B: criação interna exige a autorização imutável app_metadata.role = internal.
grant insert on table public.contracts to authenticated;

create policy "internal users can create contracts"
on public.contracts
for insert
to authenticated
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') = 'internal'
);
