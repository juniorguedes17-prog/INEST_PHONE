import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('./20261010000000_internal_buyer_registration.sql', import.meta.url),
  'utf8',
);

test('the internal edit RPC requires the existing internal role and validates the approved registration fields', () => {
  assert.match(
    migration,
    /auth\.jwt\(\) -> 'app_metadata' ->> 'role'\) is distinct from 'internal'/,
  );
  assert.match(migration, /count\(\*\) from jsonb_object_keys\(p_values\)/);
  assert.match(migration, /p_values ->> 'personType' not in \('PF', 'PJ'\)/);
  assert.match(migration, /invalid buyer registration data/);
  assert.match(
    migration,
    /grant execute on function public\.update_contract_buyer_registration\(uuid, jsonb, jsonb\) to authenticated/,
  );
});

test('the internal edit RPC rejects stale snapshots and leaves public and commercial fields untouched', () => {
  const update = migration.slice(
    migration.indexOf('  update public.contracts'),
    migration.indexOf('  return case when found', migration.indexOf('  update public.contracts')),
  );
  assert.match(update, /p_expected ->> 'fullName'\) is not distinct from client_full_name/);
  assert.match(update, /p_expected ->> 'phone'\) is not distinct from client_phone/);
  assert.doesNotMatch(update, /public_link_|product_|negotiation_|status\s*=/);
  assert.match(migration, /return case when found then 'updated' else 'conflict' end/);
});
