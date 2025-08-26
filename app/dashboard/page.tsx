'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/* =========================================================
 * Helper: portapapeles (con fallback)
 * ======================================================= */
async function writeClipboard(text: string): Promise<boolean> {
  if ((window as any).isSecureContext && navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return true } catch {}
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    if (!ok) window.prompt('Copiar al portapapeles:', text)
    return ok
  } catch {
    window.prompt('Copiar al portapapeles:', text)
    return false
  }
}

/* =========================================================
 * Tipos y mock data
 * ======================================================= */
type PeriodKey = '30d' | '90d' | 'fy'
type Risk = 'Low' | 'Medium' | 'High'

type SquadMetrics = {
  squad: string
  evaluated: number
  viaCriterion: number
  viaFramework: number
  risk: { low: number; medium: number; high: number }
  ttrAvgDays: number
  adoptionPct: number
  points: number
}

type PeriodDataset = {
  evaluatedTotal: number
  ttrAvgDays: number
  adoptionPct: number
  risk: { low: number; medium: number; high: number }
  squads: SquadMetrics[]
  lastActivity: Array<{ key: string; title: string; decision: 'PASA' | 'NO PASA' | 'REVISAR'; risk?: Risk; when: string }>
}

const MOCK: Record<PeriodKey, PeriodDataset> = {
  '30d': {
    evaluatedTotal: 148,
    ttrAvgDays: 3.2,
    adoptionPct: 72,
    risk: { low: 89, medium: 42, high: 17 },
    squads: [
      { squad: 'Core',      evaluated: 36, viaCriterion: 20, viaFramework: 16, risk: { low: 22, medium: 10, high: 4 }, ttrAvgDays: 2.6, adoptionPct: 81, points: 1280 },
      { squad: 'Payments',  evaluated: 28, viaCriterion: 12, viaFramework: 16, risk: { low: 14, medium: 9,  high: 5 }, ttrAvgDays: 3.9, adoptionPct: 66, points: 1030 },
      { squad: 'Growth',    evaluated: 24, viaCriterion: 14, viaFramework: 10, risk: { low: 17, medium: 6,  high: 1 }, ttrAvgDays: 2.2, adoptionPct: 78, points: 1150 },
      { squad: 'Mobile',    evaluated: 30, viaCriterion: 17, viaFramework: 13, risk: { low: 18, medium: 9,  high: 3 }, ttrAvgDays: 3.0, adoptionPct: 69, points: 1100 },
      { squad: 'Platform',  evaluated: 30, viaCriterion: 11, viaFramework: 19, risk: { low: 18, medium: 8,  high: 4 }, ttrAvgDays: 4.2, adoptionPct: 62, points: 960  },
    ],
    lastActivity: [
      { key: 'CS-413', title: 'JWT refresh flow',     decision: 'REVISAR', risk: 'Medium', when: 'hoy' },
      { key: 'PAY-882', title: 'Webhooks PSP v2',     decision: 'NO PASA', risk: 'High',   when: 'ayer' },
      { key: 'MOB-129', title: 'Deep links campañas', decision: 'PASA',                    when: 'ayer' },
      { key: 'PLAT-330', title: 'Upgrade Node LTS',   decision: 'PASA',                    when: 'hace 2 días' },
      { key: 'GRW-207', title: 'Beta landing prom.',  decision: 'PASA',                    when: 'hace 3 días' },
    ],
  },
  '90d': {
    evaluatedTotal: 441,
    ttrAvgDays: 3.5,
    adoptionPct: 68,
    risk: { low: 268, medium: 131, high: 42 },
    squads: [
      { squad: 'Core',      evaluated: 104, viaCriterion: 55, viaFramework: 49, risk: { low: 64, medium: 30, high: 10 }, ttrAvgDays: 2.9, adoptionPct: 80, points: 3520 },
      { squad: 'Payments',  evaluated: 90,  viaCriterion: 39, viaFramework: 51, risk: { low: 44, medium: 30, high: 16 }, ttrAvgDays: 4.1, adoptionPct: 61, points: 3050 },
      { squad: 'Growth',    evaluated: 78,  viaCriterion: 43, viaFramework: 35, risk: { low: 55, medium: 20, high: 3  }, ttrAvgDays: 2.4, adoptionPct: 76, points: 3300 },
      { squad: 'Mobile',    evaluated: 84,  viaCriterion: 44, viaFramework: 40, risk: { low: 49, medium: 27, high: 8  }, ttrAvgDays: 3.2, adoptionPct: 67, points: 3190 },
      { squad: 'Platform',  evaluated: 85,  viaCriterion: 29, viaFramework: 56, risk: { low: 56, medium: 24, high: 5  }, ttrAvgDays: 4.4, adoptionPct: 59, points: 2910 },
    ],
    lastActivity: [
      { key: 'CS-311',  title: 'Session hardening', decision: 'PASA',                    when: 'hace 1 sem' },
      { key: 'PAY-771', title: 'Legacy callback',   decision: 'REVISAR', risk: 'Medium', when: 'hace 1 sem' },
      { key: 'MOB-101', title: 'Permisos iOS',      decision: 'REVISAR', risk: 'Medium', when: 'hace 2 sem' },
      { key: 'PLAT-222',title: 'Rotate secrets',    decision: 'NO PASA',  risk: 'High',  when: 'hace 3 sem' },
    ],
  },
  fy: {
    evaluatedTotal: 1620,
    ttrAvgDays: 3.8,
    adoptionPct: 64,
    risk: { low: 980, medium: 510, high: 130 },
    squads: [
      { squad: 'Core',      evaluated: 430, viaCriterion: 230, viaFramework: 200, risk: { low: 266, medium: 130, high: 34 }, ttrAvgDays: 3.1, adoptionPct: 78, points: 12100 },
      { squad: 'Payments',  evaluated: 370, viaCriterion: 160, viaFramework: 210, risk: { low: 178, medium: 128, high: 64 }, ttrAvgDays: 4.3, adoptionPct: 58, points: 10940 },
      { squad: 'Growth',    evaluated: 315, viaCriterion: 170, viaFramework: 145, risk: { low: 225, medium: 80, high: 10  }, ttrAvgDays: 2.6, adoptionPct: 75, points: 11480 },
      { squad: 'Mobile',    evaluated: 270, viaCriterion: 143, viaFramework: 127, risk: { low: 159, medium: 86, high: 25  }, ttrAvgDays: 3.4, adoptionPct: 66, points: 11120 },
      { squad: 'Platform',  evaluated: 235, viaCriterion: 92,  viaFramework: 143, risk: { low: 152, medium: 86, high: 17  }, ttrAvgDays: 4.6, adoptionPct: 57, points: 10230 },
    ],
    lastActivity: [
      { key: 'PAY-500', title: 'PCI quarterly tasks', decision: 'REVISAR', risk: 'Medium', when: 'hace 2 meses' },
      { key: 'CS-999',  title: 'Revisión modelo roles', decision: 'NO PASA', risk: 'High', when: 'hace 3 meses' },
    ],
  },
}

function clamp(n: number, min = 0, max = 100) { return Math.max(min, Math.min(max, n)) }

/* =========================================================
 * UI helpers
 * ======================================================= */
function RiskPill({ level, value }: { level: Risk; value: number }) {
  const cls = level === 'High' ? 'bg-rose-600' : level === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <Badge className={cn('text-white', cls)}>
      {level} · {value}
    </Badge>
  )
}

function StackedRiskBar({ low, medium, high }: { low: number; medium: number; high: number }) {
  const total = Math.max(low + medium + high, 1)
  const pLow = (low / total) * 100
  const pMed = (medium / total) * 100
  const pHigh = (high / total) * 100
  return (
    <div className="h-2 w-full rounded bg-muted overflow-hidden">
      <div className="h-full bg-emerald-500" style={{ width: `${pLow}%` }} />
      <div className="h-full bg-amber-500" style={{ width: `${pMed}%` }} />
      <div className="h-full bg-rose-600" style={{ width: `${pHigh}%` }} />
    </div>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = React.useState<PeriodKey>('30d')
  const [copied, setCopied] = React.useState<null | 'ok' | 'err'>(null)

  const data = React.useMemo<PeriodDataset>(() => MOCK[period], [period])

  const totals = React.useMemo(() => {
    const viaCriterion = data.squads.reduce((acc, s) => acc + s.viaCriterion, 0)
    const viaFramework = data.squads.reduce((acc, s) => acc + s.viaFramework, 0)
    const pctCriterion = clamp(Math.round((viaCriterion / Math.max(viaCriterion + viaFramework, 1)) * 100))
    const pctFramework = 100 - pctCriterion
    const highLowRatio = `${data.risk.high} High / ${data.risk.low} Low`
    const topSquads = [...data.squads].sort((a, b) => b.points - a.points).slice(0, 3)
    return { viaCriterion, viaFramework, pctCriterion, pctFramework, highLowRatio, topSquads }
  }, [data])

  const handleCopySummary = async () => {
    const summary = {
      period,
      evaluatedTotal: data.evaluatedTotal,
      ttrAvgDays: data.ttrAvgDays,
      adoptionPct: data.adoptionPct,
      risk: data.risk,
      viaCriterion: totals.viaCriterion,
      viaFramework: totals.viaFramework,
      squads: data.squads.map(s => ({
        squad: s.squad,
        evaluated: s.evaluated,
        viaCriterion: s.viaCriterion,
        viaFramework: s.viaFramework,
        risk: s.risk,
        ttrAvgDays: s.ttrAvgDays,
        adoptionPct: s.adoptionPct,
        points: s.points,
      })),
    }
    const ok = await writeClipboard(JSON.stringify(summary, null, 2))
    setCopied(ok ? 'ok' : 'err')
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Security Space — Dashboard (mock)</h1>
        <Badge variant="secondary">Preview</Badge>
        <div className="ml-auto" />
        <div className="flex items-center gap-4">
          <div>
            <Label className="text-xs">Periodo</Label>
            <RadioGroup
              value={period}
              onValueChange={(v: any) => setPeriod(v)}
              className="flex items-center gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="p-30d" value="30d" />
                <Label htmlFor="p-30d">30d</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="p-90d" value="90d" />
                <Label htmlFor="p-90d">90d</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="p-fy" value="fy" />
                <Label htmlFor="p-fy">FY</Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={handleCopySummary}>
            {copied === 'ok' ? 'Copiado' : copied === 'err' ? 'Error ❌' : 'Copiar resumen JSON'}
          </Button>
        </div>
      </div>

      {/* KPIs principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets evaluados ({period})</CardDescription>
            <CardTitle className="text-3xl">{data.evaluatedTotal}</CardTitle>
          </CardHeader>
<CardContent className="pt-0 pb-5 px-2 self-stretch">
  <div className="flex gap-3 justify-start w-full">
    <RiskPill level="High" value={data.risk.high} />
    <RiskPill level="Medium" value={data.risk.medium} />
    <RiskPill level="Low" value={data.risk.low} />
  </div>
</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>TTR promedio</CardDescription>
            <CardTitle className="text-3xl">{data.ttrAvgDays} d</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Tiempo desde intake hasta decisión</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Flujo de decisión</CardDescription>
            <CardTitle className="text-3xl">{totals.pctCriterion}%</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Criterio</span>
              <span>{totals.viaCriterion}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>Framework</span>
              <span>{totals.viaFramework}</span>
            </div>
            <Progress value={totals.pctCriterion} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Adopción</CardDescription>
            <CardTitle className="text-3xl">{data.adoptionPct}%</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">Escuadras usando Security Space</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Riesgo por squad */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Riesgo por squad</h2>
            <span className="text-xs text-muted-foreground">Distribución High/Medium/Low</span>
          </div>

          {data.squads.map((s) => {
            const total = Math.max(s.risk.low + s.risk.medium + s.risk.high, 1)
            const pctHigh = Math.round((s.risk.high / total) * 100)
            const pctMed  = Math.round((s.risk.medium / total) * 100)
            const pctLow  = 100 - pctHigh - pctMed
            return (
              <Card key={s.squad}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{s.squad}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.evaluated} tickets · TTR {s.ttrAvgDays}d · Adopción {s.adoptionPct}%
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary">Criterio {s.viaCriterion}</Badge>
                      <Badge variant="secondary">Framework {s.viaFramework}</Badge>
                    </div>
                  </div>
                  <div className="mt-3">
                    <StackedRiskBar low={s.risk.low} medium={s.risk.medium} high={s.risk.high} />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Low {pctLow}%</span>
                      <span>Medium {pctMed}%</span>
                      <span>High {pctHigh}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Ranking */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Ranking de squads</h2>
          {totals.topSquads.map((s, i) => (
            <Card key={s.squad} className="relative overflow-hidden">
              <CardContent className="py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-8 w-8 flex items-center justify-center rounded-full text-white text-sm font-bold',
                      i === 0 ? 'bg-emerald-600' : i === 1 ? 'bg-amber-500' : 'bg-slate-500'
                    )}>
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-medium">{s.squad}</div>
                      <div className="text-xs text-muted-foreground">{s.points} pts</div>
                    </div>
                  </div>
                  <Badge variant="secondary">Adopción {s.adoptionPct}%</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-muted-foreground">
                Puntos combinan adopción, TTR y proporción de criterios aceptados (mock).
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Actividad reciente */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Actividad reciente</h2>
          <span className="text-xs text-muted-foreground">{data.lastActivity.length} items</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.lastActivity.map((a, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{a.key}</CardTitle>
                  <Badge className={cn(
                    'text-white',
                    a.decision === 'PASA'    && 'bg-emerald-600',
                    a.decision === 'REVISAR' && 'bg-amber-600',
                    a.decision === 'NO PASA' && 'bg-rose-600'
                  )}>
                    {a.decision}
                  </Badge>
                </div>
                <CardDescription className="truncate">{a.title}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{a.when}</span>
                  {a.risk && <RiskPill level={a.risk} value={1} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Separator />

      {/* Pie de página */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Mock de métricas — orientativo para layout/UX. Ajustar a fuentes reales (Jira, SAST/DAST/SCA) en la fase Dashboards.
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setPeriod('30d')}>Reset 30d</Button>
          <Button onClick={handleCopySummary}>Copiar resumen JSON</Button>
        </div>
      </div>
    </div>
  )
}

