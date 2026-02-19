export interface PaymentQRData {
  name: string;
  personalAcc: string;
  bankName: string;
  bik: string;
  corrAcc: string;
  payeeINN: string;
  kpp?: string;
  lastName?: string;
  payerAddress?: string;
  purpose: string;
  sum?: number;
}

export function buildPaymentQRString(data: PaymentQRData): string {
  const fields: string[] = [];
  fields.push(`Name=${data.name}`);
  fields.push(`PersonalAcc=${data.personalAcc}`);
  fields.push(`BankName=${data.bankName}`);
  fields.push(`BIC=${data.bik}`);
  fields.push(`CorrespAcc=${data.corrAcc}`);
  fields.push(`PayeeINN=${data.payeeINN}`);
  if (data.kpp) fields.push(`KPP=${data.kpp}`);
  if (data.lastName) fields.push(`LastName=${data.lastName}`);
  if (data.payerAddress) fields.push(`PayerAddress=${data.payerAddress}`);
  fields.push(`Purpose=${data.purpose}`);
  if (data.sum && data.sum > 0) fields.push(`Sum=${Math.round(data.sum * 100)}`);

  return `ST00012|${fields.join("|")}`;
}

export default buildPaymentQRString;
