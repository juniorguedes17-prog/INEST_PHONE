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

  if (values.documentNumber && !(values.personType === 'PF' ? isValidCpf(values.documentNumber) : isValidCnpj(values.documentNumber))) {
    errors.documentNumber = values.personType === 'PF' ? 'Informe um CPF válido.' : 'Informe um CNPJ válido.';
  }
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'Informe um e-mail válido.';
  if (onlyDigits(values.postalCode).length !== 8) errors.postalCode = 'Informe um CEP válido.';
  if (!/^[A-Za-z]{2}$/.test(values.state.trim())) errors.state = 'Informe a sigla do estado com 2 letras.';
  if (![10, 11].includes(onlyDigits(values.phone).length)) errors.phone = 'Informe um telefone válido.';

  return errors;
}
