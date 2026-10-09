'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  formatDocument,
  formatPhone,
  formatPostalCode,
  validatePublicBuyerForm,
  type PublicBuyerFormErrors,
  type PublicBuyerFormValues,
} from '../../../lib/public-buyer-form';

const initialValues: PublicBuyerFormValues = {
  fullName: '',
  personType: 'PF',
  documentNumber: '',
  email: '',
  addressStreet: '',
  addressNumber: '',
  addressNeighborhood: '',
  addressComplement: '',
  postalCode: '',
  city: '',
  state: '',
  phone: '',
};

export function PublicBuyerForm() {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<PublicBuyerFormErrors>({});
  const [isValidated, setIsValidated] = useState(false);
  const documentLabel = values.personType === 'PF' ? 'CPF' : 'CNPJ';
  const nameLabel = values.personType === 'PF' ? 'Nome completo' : 'Razão social';

  function updateField(field: keyof PublicBuyerFormValues, value: string) {
    setIsValidated(false);
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function handlePersonTypeChange(event: ChangeEvent<HTMLInputElement>) {
    const personType = event.target.value as PublicBuyerFormValues['personType'];
    setIsValidated(false);
    setValues((current) => ({
      ...current,
      personType,
      documentNumber: formatDocument(current.documentNumber, personType),
    }));
    setErrors((current) => ({ ...current, documentNumber: undefined }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validatePublicBuyerForm(values);
    setErrors(nextErrors);
    setIsValidated(Object.keys(nextErrors).length === 0);
  }

  return (
    <form className="public-buyer-form" noValidate onSubmit={handleSubmit}>
      <fieldset className="public-buyer-fieldset">
        <legend>Tipo de cadastro</legend>
        <div className="public-buyer-choice-group">
          <label><input checked={values.personType === 'PF'} name="personType" onChange={handlePersonTypeChange} type="radio" value="PF" /> Pessoa física</label>
          <label><input checked={values.personType === 'PJ'} name="personType" onChange={handlePersonTypeChange} type="radio" value="PJ" /> Pessoa jurídica</label>
        </div>
      </fieldset>

      <div className="public-buyer-grid">
        <Field error={errors.fullName} label={nameLabel} required><input autoComplete="name" name="fullName" onChange={(event) => updateField('fullName', event.target.value)} value={values.fullName} /></Field>
        <Field error={errors.documentNumber} label={documentLabel} required><input inputMode="numeric" name="documentNumber" onChange={(event) => updateField('documentNumber', formatDocument(event.target.value, values.personType))} value={values.documentNumber} /></Field>
        <Field error={errors.email} label="E-mail" required><input autoComplete="email" inputMode="email" name="email" onChange={(event) => updateField('email', event.target.value)} type="email" value={values.email} /></Field>
        <Field error={errors.phone} label="Telefone" required><input autoComplete="tel" inputMode="tel" name="phone" onChange={(event) => updateField('phone', formatPhone(event.target.value))} value={values.phone} /></Field>
        <Field className="public-buyer-grid-full" error={errors.addressStreet} label="Logradouro" required><input autoComplete="street-address" name="addressStreet" onChange={(event) => updateField('addressStreet', event.target.value)} value={values.addressStreet} /></Field>
        <Field error={errors.addressNumber} label="Número" required><input name="addressNumber" onChange={(event) => updateField('addressNumber', event.target.value)} value={values.addressNumber} /></Field>
        <Field error={errors.addressComplement} label="Complemento"><input name="addressComplement" onChange={(event) => updateField('addressComplement', event.target.value)} value={values.addressComplement} /></Field>
        <Field error={errors.addressNeighborhood} label="Bairro" required><input name="addressNeighborhood" onChange={(event) => updateField('addressNeighborhood', event.target.value)} value={values.addressNeighborhood} /></Field>
        <Field error={errors.postalCode} label="CEP" required><input autoComplete="postal-code" inputMode="numeric" name="postalCode" onChange={(event) => updateField('postalCode', formatPostalCode(event.target.value))} value={values.postalCode} /></Field>
        <Field error={errors.city} label="Cidade" required><input autoComplete="address-level2" name="city" onChange={(event) => updateField('city', event.target.value)} value={values.city} /></Field>
        <Field error={errors.state} label="UF" required><input autoComplete="address-level1" maxLength={2} name="state" onChange={(event) => updateField('state', event.target.value.toUpperCase())} value={values.state} /></Field>
      </div>

      <button className="public-buyer-submit" type="submit">Validar dados</button>
      {isValidated ? <p className="public-buyer-pending" role="status">Os dados foram validados neste dispositivo. O envio ainda não está disponível e nada foi enviado.</p> : null}
    </form>
  );
}

function Field({ children, className, error, label, required }: { children: React.ReactNode; className?: string; error?: string; label: string; required?: boolean }) {
  return <label className={`public-buyer-field${className ? ` ${className}` : ''}`}><span>{label}{required ? ' *' : ''}</span>{children}{error ? <small role="alert">{error}</small> : null}</label>;
}
