import { createMapStore } from "@/backend/shared/persist/map-store";
import type { WalletAccount, WalletLedgerEntry } from "./wallet.types";

const store = createMapStore<WalletAccount>("wallets.json");

function emptyWallet(userId: string): WalletAccount {
  return { userId, balance: 0, ledger: [] };
}

export async function getWalletAccount(userId: string): Promise<WalletAccount> {
  const existing = await store.get(userId);
  if (existing) return existing;
  return store.set(userId, emptyWallet(userId));
}

export async function saveWalletAccount(
  account: WalletAccount
): Promise<WalletAccount> {
  return store.set(account.userId, account);
}

export async function hasLedgerRef(
  userId: string,
  refId: string
): Promise<boolean> {
  const account = await getWalletAccount(userId);
  return account.ledger.some((entry) => entry.refId === refId);
}

export async function appendLedgerEntry(
  userId: string,
  entry: Omit<WalletLedgerEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<WalletAccount> {
  const account = await getWalletAccount(userId);
  const nextEntry: WalletLedgerEntry = {
    id:
      entry.id ??
      `led-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    amount: entry.amount,
    reason: entry.reason,
    source: entry.source,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    refId: entry.refId,
  };

  const next: WalletAccount = {
    ...account,
    balance: Math.max(0, account.balance + entry.amount),
    ledger: [nextEntry, ...account.ledger].slice(0, 100),
  };

  return saveWalletAccount(next);
}

export async function clearWalletForUser(userId: string) {
  await store.delete(userId);
}
