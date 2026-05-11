/**
 * Credits Service
 * ───────────────
 * Manages merchant credit balances and transactions.
 */

import { eq, sql } from "drizzle-orm";
import {
  db,
  merchantCreditsTable,
  creditTransactionsTable,
} from "@workspace/db";
import { logger } from "./logger";

/**
 * Get the current credit balance for a merchant.
 * Creates a record with 0 balance if none exists.
 */
export async function getBalance(merchantId: string): Promise<number> {
  const [row] = await db
    .select({ balance: merchantCreditsTable.balance })
    .from(merchantCreditsTable)
    .where(eq(merchantCreditsTable.merchantId, merchantId))
    .limit(1);

  if (!row) {
    // Auto-create with 0 balance
    await db.insert(merchantCreditsTable).values({
      merchantId,
      balance: 0,
    });
    return 0;
  }

  return row.balance;
}

/**
 * Check if a merchant has enough credits for a charge.
 */
export async function hasEnoughCredits(
  merchantId: string,
  amount: number,
): Promise<boolean> {
  const balance = await getBalance(merchantId);
  return balance >= amount;
}

/**
 * Charge credits from a merchant's balance.
 * Returns the new balance, or throws if insufficient.
 */
export async function chargeCredits(params: {
  merchantId: string;
  amount: number;
  contentTaskId?: string;
  description?: string;
}): Promise<number> {
  const { merchantId, amount, contentTaskId, description } = params;

  if (amount <= 0) {
    throw new Error("Charge amount must be positive");
  }

  // Atomic update with check
  const result = await db
    .update(merchantCreditsTable)
    .set({
      balance: sql`${merchantCreditsTable.balance} - ${amount}`,
    })
    .where(
      eq(merchantCreditsTable.merchantId, merchantId),
    )
    .returning({ balance: merchantCreditsTable.balance });

  if (result.length === 0) {
    // No record exists, create one first
    await db.insert(merchantCreditsTable).values({
      merchantId,
      balance: 0,
    });
    throw new InsufficientCreditsError(merchantId, amount, 0);
  }

  const newBalance = result[0].balance;

  if (newBalance < 0) {
    // Rollback - restore the balance
    await db
      .update(merchantCreditsTable)
      .set({
        balance: sql`${merchantCreditsTable.balance} + ${amount}`,
      })
      .where(eq(merchantCreditsTable.merchantId, merchantId));

    throw new InsufficientCreditsError(merchantId, amount, newBalance + amount);
  }

  // Log the transaction
  await db.insert(creditTransactionsTable).values({
    merchantId,
    type: "charge",
    amount: -amount,
    balanceAfter: newBalance,
    contentTaskId: contentTaskId ?? null,
    description: description ?? `خصم ${amount} رصيد لتوليد محتوى`,
  });

  logger.info(
    { merchantId, amount, newBalance, contentTaskId },
    "credits_charged",
  );

  return newBalance;
}

/**
 * Add credits to a merchant's balance (top-up or refund).
 */
export async function addCredits(params: {
  merchantId: string;
  amount: number;
  type: "topup" | "refund";
  contentTaskId?: string;
  description?: string;
}): Promise<number> {
  const { merchantId, amount, type, contentTaskId, description } = params;

  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Ensure record exists
  const existing = await db
    .select()
    .from(merchantCreditsTable)
    .where(eq(merchantCreditsTable.merchantId, merchantId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(merchantCreditsTable).values({
      merchantId,
      balance: amount,
    });

    await db.insert(creditTransactionsTable).values({
      merchantId,
      type,
      amount,
      balanceAfter: amount,
      contentTaskId: contentTaskId ?? null,
      description: description ?? `إضافة ${amount} رصيد`,
    });

    return amount;
  }

  const result = await db
    .update(merchantCreditsTable)
    .set({
      balance: sql`${merchantCreditsTable.balance} + ${amount}`,
    })
    .where(eq(merchantCreditsTable.merchantId, merchantId))
    .returning({ balance: merchantCreditsTable.balance });

  const newBalance = result[0].balance;

  await db.insert(creditTransactionsTable).values({
    merchantId,
    type,
    amount,
    balanceAfter: newBalance,
    contentTaskId: contentTaskId ?? null,
    description: description ?? `إضافة ${amount} رصيد`,
  });

  logger.info({ merchantId, amount, type, newBalance }, "credits_added");

  return newBalance;
}

/**
 * Get transaction history for a merchant.
 */
export async function getTransactionHistory(
  merchantId: string,
  limit = 50,
) {
  return db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.merchantId, merchantId))
    .orderBy(sql`${creditTransactionsTable.createdAt} DESC`)
    .limit(limit);
}

export class InsufficientCreditsError extends Error {
  readonly merchantId: string;
  readonly required: number;
  readonly available: number;

  constructor(merchantId: string, required: number, available: number) {
    super(
      `Insufficient credits: required ${required}, available ${available}`,
    );
    this.name = "InsufficientCreditsError";
    this.merchantId = merchantId;
    this.required = required;
    this.available = available;
  }
}
