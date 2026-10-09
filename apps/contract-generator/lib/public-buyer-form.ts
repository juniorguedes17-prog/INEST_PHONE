import type { PersonType } from '../domain/contract';

export type PublicBuyerFormValues = {
  fullName: string;
  personType: PersonType;
  documentNumber: string;
  email: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressComplement: string;
  postalCode: string;
  city: string;
  state: string;
  phone: string;
};

export type PublicBuyerFormErrors = Partial<Record<keyof PublicBuyerFormValues, string>>;

export type PublicBuyerSubmissionParams = {
  p_public_token: string;
  p_client_full_name: string;
  p_client_person_type: PersonType;
  p_client_document_number: string;
  p_client_email: string;
  p_client_address_street: string;
  p_client_address_number: string;
  p_client_address_neighborhood: string;
  p_client_address_complement: string;
  p_client_postal_code: string;
  p_client_city: string;
  p_client_state: string;
  p_client_phone: string;
};

export type StoredBuyerRegistration = {
  client_full_name: string | null;
  client_person_type: PersonType | null;
  client_document_number: string | null;
  client_email: string | null;
  client_address_street: string | null;
  client_address_number: string | null;
  client_address_neighborhood: string | null;
  client_address_complement: string | null;
  client_postal_code: string | null;
  client_city: string | null;
  client_state: string | null;
  client_phone: string | null;
};

export type InternalBuyerRegistrationUpdateParams = {
  p_contract_id: string;
  p_expected: BuyerRegistrationSnapshot;
  p_values: PublicBuyerFormValues;
};

export type BuyerRegistrationSnapshot = {
  fullName: string | null;
  personType: PersonType | null;
  documentNumber: string | null;
  email: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressComplement: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');

export function formatDocument(value: string, personType: PersonType) {
  const digits = onlyDigits(value).slice(0, personType === 'PF' ? 11 : 14);

  if (personType === 'PF') {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2}\.\d{3})(\d)/, '$1.$2')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatPostalCode(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function hasOnlyRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || hasOnlyRepeatedDigits(digits)) return false;

  const checkDigit = (length: number) => {
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

export function isValidCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || hasOnlyRepeatedDigits(digits)) return false;

  const checkDigit = (length: number) => {
    let weight = length === 12 ? 5 : 6;
    const sum = digits
      .slice(0, length)
      .split('')
      .reduce((total, digit) => {
        const result = total + Number(digit) * weight;
        weight = weight === 2 ? 9 : weight - 1;
        return result;
      }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(12) === Number(digits[12]) && checkDigit(13) === Number(digits[13]);
}

export function validatePublicBuyerForm(values: PublicBuyerFormValues): PublicBuyerFormErrors {
  const errors: PublicBuyerFormErrors = {};
  const requiredFields: Array<keyof PublicBuyerFormValues> = [
    'fullName',
    'documentNumber',
    'email',
    'addressStreet',
    'addressNumber',
    'addressNeighborhood',
    'postalCode',
    'city',
    'state',
    'phone',
  ];

  requiredFields.forEach((field) => {
    if (!values[field].trim()) errors[field] = 'Este campo é obrigatório.';
  });

  if (
    values.documentNumber &&
    !(values.personType === 'PF'
      ? isValidCpf(values.documentNumber)
      : isValidCnpj(values.documentNumber))
  ) {
    errors.documentNumber =
      values.personType === 'PF' ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.';
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = 'Informe um e-mail válido.';
  if (onlyDigits(values.postalCode).length !== 8) errors.postalCode = 'Informe um CEP válido.';
  if (!/^[A-Za-z]{2}$/.test(values.state.trim()))
    errors.state = 'Informe a sigla do estado com 2 letras.';
  if (![10, 11].includes(onlyDigits(values.phone).length))
    errors.phone = 'Informe um telefone válido.';

  return errors;
}

export function toPublicBuyerSubmissionParams(
  publicToken: string,
  values: PublicBuyerFormValues,
): PublicBuyerSubmissionParams {
  return {
    p_public_token: publicToken,
    p_client_full_name: values.fullName,
    p_client_person_type: values.personType,
    p_client_document_number: values.documentNumber,
    p_client_email: values.email,
    p_client_address_street: values.addressStreet,
    p_client_address_number: values.addressNumber,
    p_client_address_neighborhood: values.addressNeighborhood,
    p_client_address_complement: values.addressComplement,
    p_client_postal_code: values.postalCode,
    p_client_city: values.city,
    p_client_state: values.state,
    p_client_phone: values.phone,
  };
}

export function isPublicBuyerSubmissionAccepted(data: unknown, error: unknown) {
  return !error && data === true;
}

export function toPublicBuyerFormValues(
  value: StoredBuyerRegistration | null,
): PublicBuyerFormValues {
  return {
    fullName: value?.client_full_name ?? '',
    personType: value?.client_person_type ?? 'PF',
    documentNumber: value?.client_document_number ?? '',
    email: value?.client_email ?? '',
    addressStreet: value?.client_address_street ?? '',
    addressNumber: value?.client_address_number ?? '',
    addressNeighborhood: value?.client_address_neighborhood ?? '',
    addressComplement: value?.client_address_complement ?? '',
    postalCode: value?.client_postal_code ?? '',
    city: value?.client_city ?? '',
    state: value?.client_state ?? '',
    phone: value?.client_phone ?? '',
  };
}

export function toInternalBuyerRegistrationUpdateParams(
  contractId: string,
  expected: StoredBuyerRegistration,
  values: PublicBuyerFormValues,
): InternalBuyerRegistrationUpdateParams {
  return {
    p_contract_id: contractId,
    p_expected: {
      fullName: expected.client_full_name,
      personType: expected.client_person_type,
      documentNumber: expected.client_document_number,
      email: expected.client_email,
      addressStreet: expected.client_address_street,
      addressNumber: expected.client_address_number,
      addressNeighborhood: expected.client_address_neighborhood,
      addressComplement: expected.client_address_complement,
      postalCode: expected.client_postal_code,
      city: expected.client_city,
      state: expected.client_state,
      phone: expected.client_phone,
    },
    p_values: values,
  };
}

export function isInternalBuyerRegistrationUpdated(data: unknown, error: unknown) {
  return !error && data === 'updated';
}
