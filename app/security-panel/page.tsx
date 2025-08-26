'use client'

import * as React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line,
} from 'recharts'

// ===== Tipos =====
type Risk = 'Low' | 'Medium' | 'High'
type StatusKey = 'pending' | 'inProgress' | 'review' | 'blocked' | 'prioritize'

type QueueItem = {
  key: string
  title: string
  squad: string
  risk: Risk
  status: 'To Do' | 'In Progress' | 'In Review' | 'Blocked'
  ageDays: number
}

type SOCDataset = {
  kpis: {
    totalOpen: number
    pending: number
    inProgress: number
    review: number
    blocked: number
    prioritize: number
    slaBreached: number
    mttrDays: number
    mttaHours: number
  }
  statusDistribution: Array<{ name: string; value: number }>
  riskDistribution: Array<{ name: Risk; value: number }>
  backlogTrend: Array<{ date: string; open: number }>
  riskStackedByWeek: Array<{ week: string; Low: number; Medium: number; High: number }>
  bubbleNodes: Array<{ id: string; label: string; value: number }>
  triageQueue: QueueItem[]
  recentActivity: Array<{ key: string; title: string; when: string; status: string }>
}

// ===== Mock local (fallback) =====
const MOCK: Record<'30d'|'90d'|'fy', SOCDataset> = {
  '30d': {
    kpis: {
      totalOpen: 182, pending: 64, inProgress: 48, review: 28, blocked: 12, prioritize: 30,
      slaBreached: 9, mttrDays: 3.2, mttaHours: 5.6,
    },
    statusDistribution: [
      { name: 'Pendiente', value: 64 },
      { name: 'En progreso', value: 48 },
      { name: 'Revisión', value: 28 },
      { name: 'Bloqueado', value: 12 },
      { name: 'Priorizar', value: 30 },
    ],
    riskDistribution: [
      { name: 'Low', value: 92 },
      { name: 'Medium', value: 63 },
      { name: 'High', value: 27 },
    ],
    backlogTrend: [
      { date: 'W-4', open: 175 },
      { date: 'W-3', open: 168 },
      { date: 'W-2', open: 176 },
      { date: 'W-1', open: 181 },
      { date: 'W-0', open: 182 },
    ],
    riskStackedByWeek: [
      { week: 'W-4', Low: 18, Medium: 12, High: 6 },
      { week: 'W-3', Low: 21, Medium: 10, High: 7 },
      { week: 'W-2', Low: 20, Medium: 14, High: 5 },
      { week: 'W-1', Low: 17, Medium: 12, High: 8 },
      { week: 'W-0', Low: 16, Medium: 15, High: 9 },
    ],
    bubbleNodes: [
      { id: 'auth', label: 'Auth', value: 18 },
      { id: 'payments', label: 'Payments', value: 24 },
      { id: 'mobile', label: 'Mobile', value: 15 },
      { id: 'platform', label: 'Platform', value: 20 },
      { id: 'growth', label: 'Growth', value: 14 },
      { id: 'content', label: 'Content', value: 9 },
      { id: 'xchan', label: 'X-Channel', value: 12 },
    ],
    triageQueue: [
      { key: 'SEC-1203', title: 'Refactor token refresh', squad: 'Platform', risk: 'Medium', status: 'In Progress', ageDays: 3 },
      { key: 'SEC-1211', title: 'S3 bucket policy review', squad: 'Core', risk: 'Low', status: 'To Do', ageDays: 8 },
      { key: 'SEC-1194', title: 'IDOR en /accounts', squad: 'Payments', risk: 'High', status: 'Blocked', ageDays: 2 },
      { key: 'SEC-1188', title: 'DAST false positive triage', squad: 'Mobile', risk: 'Low', status: 'In Review', ageDays: 1 },
      { key: 'SEC-1207', title: 'OAuth scope audit', squad: 'Growth', risk: 'Medium', status: 'To Do', ageDays: 5 },
    ],
    recentActivity: [
      { key: 'SEC-1214', title: 'JWT rotation completed', when: 'hace 2h', status: 'Done' },
      { key: 'SEC-1212', title: 'Add CSP report-only', when: 'hace 6h', status: 'In Review' },
      { key: 'SEC-1210', title: 'Limit file upload size', when: 'ayer', status: 'In Progress' },
    ],
  },
  '90d': null as any, // rellenamos simple reutilizando 30d para el ejemplo
  'fy': null as any,
}
MOCK['90d'] = MOCK['30d']
MOCK['fy']  = MOCK['30d']

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#94a3b8'] // indigo, emerald, amber, rose, slate
const RISK_COLORS: Record<Risk, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' }

// ===== Componente de “red” radial (burbujas) =====
function RadialBubbles({ nodes }: { nodes: Array<{ id: string; label: string; value: number }> }) {
  const radius = 140
  const max = Math.max(...nodes.map(n => n.value), 1)
  return (
    <div className="relative h-[320px]">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="size-40 rounded-full bg-muted/40" />
      </div>
      {nodes.map((n, i) => {
        const angle = (i / nodes.length) * Math.PI * 2
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        const sz = 36 + (n.value / max) * 36 // 36..72
        return (
          <div
            key={n.id}
            className="absolute flex flex-col items-center"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: 'translate(-50%, -50%)' }}
          >
            <div className="rounded-full bg-indigo-600 text-white grid place-items-center shadow-md" style={{ width: sz, height: sz }}>
              <span className="text-sm font-semibold">{n.value}</span>
            </div>
            <span className="mt-1 text-xs text-muted-foreground">{n.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SOCDashboard() {
  const [period, setPeriod] = React.useState<'30d'|'90d'|'fy'>('30d')
  const [data, setData] = React.useState<SOCDataset | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/soc?period=${period}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(json => { if (active) setData(json) })
      .catch(() => { if (active) setData(MOCK[period]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [period])

  const view = data || MOCK[period]
  const k = view.kpis

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Security Panel</h1>
          <p className="text-sm text-muted-foreground">Backlog operativo, riesgo y flujo de trabajo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Periodo</Label>
          <div className="flex rounded-xl border bg-background p-1">
            {(['30d','90d','fy'] as const).map(p => (
              <Button key={p} size="sm" variant={p===period?'default':'ghost'} onClick={() => setPeriod(p)} className="px-3">
                {p==='30d'?'30 días':p==='90d'?'90 días':'Año'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardDescription>Abiertos</CardDescription><CardTitle className="text-3xl">{k.totalOpen}</CardTitle></CardHeader><CardContent><Badge variant="secondary">SLA {k.slaBreached} breach</Badge></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Pendientes</CardDescription><CardTitle className="text-3xl">{k.pending}</CardTitle></CardHeader><CardContent><span className="text-xs text-muted-foreground">Need triage</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>En progreso</CardDescription><CardTitle className="text-3xl">{k.inProgress}</CardTitle></CardHeader><CardContent><span className="text-xs text-muted-foreground">WIP</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Revisión</CardDescription><CardTitle className="text-3xl">{k.review}</CardTitle></CardHeader><CardContent><span className="text-xs text-muted-foreground">Sec review</span></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Priorizar</CardDescription><CardTitle className="text-3xl">{k.prioritize}</CardTitle></CardHeader><CardContent><span className="text-xs text-muted-foreground">Queue</span></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Donut status */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Distribución por estado</CardTitle>
            <CardDescription>Backlog por fase</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={view.statusDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {view.statusDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Stacked riesgo */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Nuevos por semana (stacked por riesgo)</CardTitle>
            <CardDescription>Volumen reciente por criticidad</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.riskStackedByWeek}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Low" stackId="a" fill={RISK_COLORS.Low} />
                <Bar dataKey="Medium" stackId="a" fill={RISK_COLORS.Medium} />
                <Bar dataKey="High" stackId="a" fill={RISK_COLORS.High} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Backlog trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Backlog abierto</CardTitle>
            <CardDescription>Tamaño del backlog (últimas semanas)</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={view.backlogTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="open" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* “Red” de burbujas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapa de focos (burbujas)</CardTitle>
            <CardDescription>Volumen por dominio/squad</CardDescription>
          </CardHeader>
          <CardContent>
            <RadialBubbles nodes={view.bubbleNodes} />
          </CardContent>
        </Card>
      </div>

      {/* Triage queue + actividad */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Triage / Priorizar</CardTitle>
            <CardDescription>Cola de atención</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {view.triageQueue.map(item => (
              <div key={item.key} className="flex items-center gap-3 rounded-xl border p-3">
                <Badge variant="secondary" className="shrink-0">{item.key}</Badge>
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.squad} • {item.status} • {item.ageDays}d
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Badge className="bg-emerald-600">{item.risk === 'Low' ? 'Low' : ''}</Badge>
                  <Badge className="bg-amber-600">{item.risk === 'Medium' ? 'Medium' : ''}</Badge>
                  <Badge className="bg-rose-600">{item.risk === 'High' ? 'High' : ''}</Badge>
                  <Button size="sm" variant="secondary">Asignar</Button>
                  <Button size="sm">Priorizar</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <CardDescription>Movimientos destacados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {view.recentActivity.map(row => (
              <div key={row.key} className="flex items-center justify-between rounded-xl border p-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{row.title}</div>
                  <div className="text-xs text-muted-foreground">{row.key} • {row.when}</div>
                </div>
                <Badge variant="outline">{row.status}</Badge>
              </div>
            ))}
            <Separator />
            <div className="text-xs text-muted-foreground">
              MTTR: <span className="font-medium">{k.mttrDays} días</span> • MTTA: <span className="font-medium">{k.mttaHours} h</span> • SLA breach: <span className="font-medium">{k.slaBreached}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-xl bg-background/80 backdrop-blur border px-3 py-2 text-xs">
          Cargando datos…
        </div>
      )}
    </div>
  )
}

