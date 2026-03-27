import { NextResponse } from 'next/server'
import { getWeaknessReport } from '@/lib/weakness-analyzer'

export async function GET() {
  try {
    const report = await getWeaknessReport()
    return NextResponse.json(report)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch weakness report' }, { status: 500 })
  }
}
