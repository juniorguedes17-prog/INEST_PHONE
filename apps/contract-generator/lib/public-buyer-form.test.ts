import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDocument,
  formatPhone,
  formatPostalCode,
  isInternalBuyerRegistrationUpdated,
  isPublicBuyerSubmissionAccepted,
  toInternalBuyerRegistrationUpdateParams,
  toPublicBuyerSubmissionParams,
  validatePublicBuyerForm,
} from './public-buyer-form';

const validPf = {
  fullName: 'Maria da Silva',
  personType: 'PF' as const,
  documentNumber: '529.982.247-25',
  email: 'maria@example.com',
  addressStreet: 'Rua das Flores',
  addressNumber: '100',
  addressNeighborhood: 'Centro',
  addressComplement: '',
  postalCode: '01001-000',
  city: 'São Paulo',
  state: 'SP',
  phone: '(11) 99876-5432',
};

test('formats CPF, CNPJ, CEP and telephone input without retaining non-digits', () => {
  assert.equal(formatDocument('52998224725', 'PF'), '529.982.247-25');
  assert.equal(formatDocument('11222333000181', 'PJ'), '11.222.333/0001-81');
  assert.equal(formatPostalCode('01001000'), '01001-000');
  assert.equal(formatPhone('11998765432'), '(11) 99876-5432');
});

test('requires only buyer registration fields and accepts a valid PF registration', () => {
  assert.deepEqual(validatePublicBuyerForm(validPf), {});
});

test('changes document validation according to person type and rejects malformed required data', () => {
  const errors = validatePublicBuyerForm({
    ...validPf,
    personType: 'PJ',
    documentNumber: '11.222.333/0001-82',
    postalCode: '01001',
    state: 'S',
    phone: '119',
  });
  assert.equal(errors.documentNumber, 'Informe um CNPJ válido.');
  assert.equal(errors.postalCode, 'Informe um CEP válido.');
  assert.equal(errors.state, 'Informe a sigla do estado com 2 letras.');
  assert.equal(errors.phone, 'Informe um telefone válido.');
});

test('builds a submission with only the approved buyer-registration fields', () => {
  const submission = toPublicBuyerSubmissionParams('A'.repeat(43), validPf);
  assert.deepEqual(Object.keys(submission).sort(), [
    'p_client_address_complement',
    'p_client_address_neighborhood',
    'p_client_address_number',
    'p_client_address_street',
    'p_client_city',
    'p_client_document_number',
    'p_client_email',
    'p_client_full_name',
    'p_client_person_type',
    'p_client_phone',
    'p_client_postal_code',
    'p_client_state',
    'p_public_token',
  ]);
  assert.equal(submission.p_client_full_name, validPf.fullName);
  assert.equal('product_model' in submission, false);
  assert.equal('negotiation_total_amount' in submission, false);
});

test('confirms receipt only after the database RPC succeeds', () => {
  assert.equal(isPublicBuyerSubmissionAccepted(true, null), true);
  assert.equal(isPublicBuyerSubmissionAccepted(false, null), false);
  assert.equal(isPublicBuyerSubmissionAccepted(true, new Error('persistence failed')), false);
});

test('maps the persisted registration to an optimistic-concurrency snapshot without commercial fields', () => {
  const update = toInternalBuyerRegistrationUpdateParams(
    'contract-id',
    {
      client_full_name: validPf.fullName,
      client_person_type: 'PF',
      client_document_number: validPf.documentNumber,
      client_email: validPf.email,
      client_address_street: validPf.addressStreet,
      client_address_number: validPf.addressNumber,
      client_address_neighborhood: validPf.addressNeighborhood,
      client_address_complement: null,
      client_postal_code: validPf.postalCode,
      client_city: validPf.city,
      client_state: validPf.state,
      client_phone: validPf.phone,
    },
    validPf,
  );
  assert.equal(update.p_expected.fullName, validPf.fullName);
  assert.equal(update.p_expected.addressComplement, null);
  assert.equal('productModel' in update.p_expected, false);
  assert.equal('negotiationTotalAmount' in update.p_expected, false);
});

test('recognizes only a completed internal registration update as successful', () => {
  assert.equal(isInternalBuyerRegistrationUpdated('updated', null), true);
  assert.equal(isInternalBuyerRegistrationUpdated('conflict', null), false);
  assert.equal(
    isInternalBuyerRegistrationUpdated('updated', new Error('persistence failed')),
    false,
  );
});
