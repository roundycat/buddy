/**
 * Wallet — mission reward currency (별조각).
 */

export type WalletLedgerSource = "quest" | "bonus" | "spend" | "adjust";

export interface WalletLedgerEntry {
  id: string;
  amount: number;
  reason: string;
  source: WalletLedgerSource;
  createdAt: string;
  /** Idempotency key, e.g. quest id */
  refId?: string;
}

export interface WalletAccount {
  userId: string;
  balance: number;
  ledger: WalletLedgerEntry[];
}

export interface WalletResponse {
  balance: number;
  currencyLabel: string;
  currencyHint: string;
  ledger: WalletLedgerEntry[];
}
