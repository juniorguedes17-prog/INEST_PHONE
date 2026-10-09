import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDocument, formatPhone, formatPostalCode, validatePublicBuyerForm } from './public-buyer-form';

const validPf = {
  fullName: 'Maria da Silva', personType: 'PF' as const, documentNumber: '529.982.247-25', email: 'maria@example.com',
  addressStreet: 'Rua das Flores', addressNumber: '100', addressNeighborhood: 'Centro', addressComplement: '', postalCode: '01001-000', city: 'São Paulo', state: 'SP', phone: '(11) 99876-5432',
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
  const errors = validatePublicBuyerForm({ ...validPf, personType: 'PJ', documentNumber: '11.222.333/0001-82', postalCode: '01001', state: 'S', phone: '119' });
  assert.equal(errors.documentNumber, 'Informe um CNPJ válido.');
  assert.equal(errors.postalCode, 'Informe um CEP válido.');
  assert.equal(errors.state, 'Informe a sigla do estado com 2 letras.');
  assert.equal(errors.phone, 'Informe um telefone válido.');
});
