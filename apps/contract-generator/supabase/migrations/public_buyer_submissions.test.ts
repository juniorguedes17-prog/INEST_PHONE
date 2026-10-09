import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('./20261009000000_public_buyer_submissions.sql', import.meta.url),
  'utf8',
);

test('the public submission RPC accepts only registration parameters and validates them server-side', () => {
  assert.match(migration, /submit_public_contract_buyer_data\([\s\S]*p_client_phone text/);
  assert.match(migration, /p_client_person_type not in \('PF', 'PJ'\)/);
  assert.match(migration, /invalid buyer registration data/);
  assert.match(migration, /length\(normalized_postal_code\) <> 8/);
  assert.match(migration, /length\(normalized_phone\) not in \(10, 11\)/);
  assert.match(
    migration,
    /grant execute on function public\.submit_public_contract_buyer_data[\s\S]*to anon, authenticated/,
  );
});

test('the public submission updates registration and revokes the matching active link atomically', () => {
  const update = migration.slice(
    migration.indexOf('  update public.contracts'),
    migration.indexOf('  return found;', migration.indexOf('  update public.contracts')),
  );
  assert.match(update, /public_link_token_hash = null/);
  assert.match(update, /public_link_revoked_at = now\(\)/);
  assert.match(update, /public_link_revoked_at is null/);
  assert.match(
    update,
    /public_link_token_hash = encode\(extensions\.digest\(p_public_token, 'sha256'\), 'hex'\)/,
  );
  assert.doesNotMatch(update, /product_|negotiation_|status\s*=/);
});

test('the internal registration RPC keeps reads behind the existing internal role', () => {
  assert.match(migration, /get_contract_buyer_registration\(p_contract_id uuid\)/);
  assert.match(
    migration,
    /auth\.jwt\(\) -> 'app_metadata' ->> 'role'\) is distinct from 'internal'/,
  );
  assert.match(
    migration,
    /grant execute on function public\.get_contract_buyer_registration\(uuid\) to authenticated/,
  );
});
