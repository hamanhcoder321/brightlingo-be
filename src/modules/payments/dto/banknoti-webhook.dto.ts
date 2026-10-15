export class BankNotiWebhookDto {
  event?: string;
  gateway?: string;
  transaction_date?: string;
  account_number?: string;
  virtual_account?: string;
  amount: number;
  description: string;
  bill_id?: string;
  id?: string | number; // external_transaction_id
}
