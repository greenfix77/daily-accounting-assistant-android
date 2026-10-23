import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { serverError } from '@/app/api/_lib/core'

export const dynamic = 'force-dynamic'

type Row = Record<string, unknown>

function pick(rows: unknown, fields: string[], dateFields: string[] = []): Row[] {
  if (!Array.isArray(rows)) return []
  return rows
    .filter((r): r is Row => typeof r === 'object' && r !== null)
    .map((r) => {
      const out: Row = {}
      for (const f of fields) {
        if (r[f] === undefined) continue
        if (dateFields.includes(f)) {
          if (r[f] === null) {
            out[f] = null
          } else {
            const d = new Date(r[f] as string | number)
            out[f] = isNaN(d.getTime()) ? null : d
          }
        } else {
          out[f] = r[f]
        }
      }
      return out
    })
}

async function insertAll(tx: Prisma.TransactionClient, model: 'account' | 'category' | 'transaction' | 'budget' | 'debt' | 'debtPayment' | 'recurring' | 'savingsGoal' | 'savingsDeposit' | 'reminder', rows: Row[]): Promise<number> {
  if (!rows.length) return 0
  switch (model) {
    case 'account':
      return (await tx.account.createMany({ data: rows as never[] })).count
    case 'category':
      return (await tx.category.createMany({ data: rows as never[] })).count
    case 'transaction':
      return (await tx.transaction.createMany({ data: rows as never[] })).count
    case 'budget':
      return (await tx.budget.createMany({ data: rows as never[] })).count
    case 'debt':
      return (await tx.debt.createMany({ data: rows as never[] })).count
    case 'debtPayment':
      return (await tx.debtPayment.createMany({ data: rows as never[] })).count
    case 'recurring':
      return (await tx.recurring.createMany({ data: rows as never[] })).count
    case 'savingsGoal':
      return (await tx.savingsGoal.createMany({ data: rows as never[] })).count
    case 'savingsDeposit':
      return (await tx.savingsDeposit.createMany({ data: rows as never[] })).count
    case 'reminder':
      return (await tx.reminder.createMany({ data: rows as never[] })).count
  }
}

// POST /api/backup/restore — body = same shape as GET /api/backup
export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => null)
    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as Row).accounts) ||
      !Array.isArray((body as Row).transactions)
    ) {
      return NextResponse.json({ error: 'فایل پشتیبان نامعتبر است' }, { status: 400 })
    }
    const b = body as Row

    const accounts = pick(b.accounts, ['id', 'name', 'type', 'color', 'icon', 'initialBalance', 'isDefault', 'createdAt'], ['createdAt'])
    const categories = pick(b.categories, ['id', 'name', 'type', 'icon', 'color', 'isDefault', 'createdAt'], ['createdAt'])
    const transactions = pick(
      b.transactions,
      ['id', 'type', 'amount', 'title', 'description', 'notes', 'receiptUrl', 'accountId', 'toAccountId', 'categoryId', 'debtId', 'recurringId', 'date', 'createdAt'],
      ['date', 'createdAt'],
    )
    const budgets = pick(b.budgets, ['id', 'month', 'amount', 'categoryId', 'createdAt'], ['createdAt'])
    const debts = pick(b.debts, ['id', 'person', 'type', 'amount', 'paidAmount', 'date', 'dueDate', 'notes', 'settledAt', 'createdAt'], ['date', 'dueDate', 'settledAt', 'createdAt'])
    const debtPayments = pick(b.debtPayments, ['id', 'debtId', 'amount', 'date', 'notes'], ['date'])
    const recurring = pick(b.recurring, ['id', 'title', 'type', 'amount', 'accountId', 'categoryId', 'frequency', 'startDate', 'endDate', 'totalCount', 'paidCount', 'lastPaidAt', 'isActive', 'createdAt'], ['startDate', 'endDate', 'lastPaidAt', 'createdAt'])
    const savingsGoals = pick(b.savingsGoals, ['id', 'name', 'targetAmount', 'targetDate', 'color', 'icon', 'createdAt'], ['targetDate', 'createdAt'])
    const savingsDeposits = pick(b.savingsDeposits, ['id', 'goalId', 'amount', 'date', 'notes'], ['date'])
    const reminders = pick(b.reminders, ['id', 'title', 'type', 'date', 'time', 'repeat', 'isDone', 'createdAt'], ['date', 'createdAt'])

    const counts = await db.$transaction(async (tx) => {
      // wipe — FK-safe order
      await tx.debtPayment.deleteMany()
      await tx.savingsDeposit.deleteMany()
      await tx.transaction.deleteMany()
      await tx.budget.deleteMany()
      await tx.recurring.deleteMany()
      await tx.reminder.deleteMany()
      await tx.savingsGoal.deleteMany()
      await tx.debt.deleteMany()
      await tx.category.deleteMany()
      await tx.account.deleteMany()

      // insert — FK order
      return {
        accounts: await insertAll(tx, 'account', accounts),
        categories: await insertAll(tx, 'category', categories),
        transactions: await insertAll(tx, 'transaction', transactions),
        budgets: await insertAll(tx, 'budget', budgets),
        debts: await insertAll(tx, 'debt', debts),
        debtPayments: await insertAll(tx, 'debtPayment', debtPayments),
        recurring: await insertAll(tx, 'recurring', recurring),
        savingsGoals: await insertAll(tx, 'savingsGoal', savingsGoals),
        savingsDeposits: await insertAll(tx, 'savingsDeposit', savingsDeposits),
        reminders: await insertAll(tx, 'reminder', reminders),
      }
    })

    // restore profile (single-user app) if present
    if (b.profile && typeof b.profile === 'object') {
      const p = pick([b.profile], ['id', 'name', 'email', 'avatar', 'language', 'theme', 'calendar', 'currency', 'weekStart', 'appLock', 'pin', 'notificationsEnabled', 'dayCounterOnHome', 'onboarded', 'createdAt'], ['createdAt'])[0]
      if (p) {
        await db.profile.upsert({
          where: { id: typeof p.id === 'string' ? p.id : 'main' },
          update: p as Prisma.ProfileUpdateInput,
          create: { ...(p as Prisma.ProfileCreateInput), id: 'main' },
        })
      }
    }

    return NextResponse.json({ ok: true, counts })
  } catch (e) {
    return serverError(e)
  }
}
