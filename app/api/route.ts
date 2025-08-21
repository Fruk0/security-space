import { NextResponse } from 'next/server'
import { getSOCDataset } from '@/lib/jira_soc'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = (searchParams.get('period') || '30d') as '30d' | '90d' | 'fy'

  try {
    const data = await getSOCDataset(period)
    return NextResponse.json(data, { status: 200 })
  } catch (e: any) {
    // Fallback a mock del front si algo falla
    return NextResponse.json({ error: e?.message || 'SOC fetch error' }, { status: 500 })
  }
}

