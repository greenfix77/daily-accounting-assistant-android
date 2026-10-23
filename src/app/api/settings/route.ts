import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverError } from '@/app/api/_lib/core'

export const dynamic = 'force-dynamic'

async function ensureProfile() {
  const existing = await db.profile.findUnique({ where: { id: 'main' } })
  if (existing) return existing
  return db.profile.create({ data: { id: 'main' } })
}

export async function GET() {
  try {
    return NextResponse.json(await ensureProfile())
  } catch (e) {
    return serverError(e)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body: Record<string, unknown> = await req.json().catch(() => ({}))
    const data: {
      name?: string
      email?: string
      avatar?: string | null
      language?: string
      theme?: string
      calendar?: string
      currency?: string
      weekStart?: string
      pin?: string | null
      appLock?: boolean
      biometricLock?: boolean
      notificationsEnabled?: boolean
      dayCounterOnHome?: boolean
      homeWidgets?: string
      onboarded?: boolean
    } = {}

    if (body.name !== undefined) data.name = String(body.name)
    if (body.email !== undefined) data.email = String(body.email)
    if (body.avatar !== undefined) data.avatar = body.avatar === null ? null : String(body.avatar)
    if (body.language !== undefined) data.language = String(body.language)
    if (body.theme !== undefined) data.theme = String(body.theme)
    if (body.calendar !== undefined) data.calendar = String(body.calendar)
    if (body.currency !== undefined) data.currency = String(body.currency)
    if (body.weekStart !== undefined) data.weekStart = String(body.weekStart)
    if (body.pin !== undefined) data.pin = body.pin === null ? null : String(body.pin)
    if (body.appLock !== undefined) data.appLock = Boolean(body.appLock)
    if (body.biometricLock !== undefined) data.biometricLock = Boolean(body.biometricLock)
    if (body.notificationsEnabled !== undefined) data.notificationsEnabled = Boolean(body.notificationsEnabled)
    if (body.dayCounterOnHome !== undefined) data.dayCounterOnHome = Boolean(body.dayCounterOnHome)
    if (body.homeWidgets !== undefined) data.homeWidgets = String(body.homeWidgets)
    if (body.onboarded !== undefined) data.onboarded = Boolean(body.onboarded)

    const profile = await ensureProfile()
    const updated = await db.profile.update({ where: { id: profile.id }, data })
    return NextResponse.json(updated)
  } catch (e) {
    return serverError(e)
  }
}
