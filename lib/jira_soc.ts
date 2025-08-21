// /lib/jira_soc.ts
// Nota: ajusta JQL según estados y flujos de tu Jira.

type PeriodKey = '30d' | '90d' | 'fy'
type Risk = 'Low' | 'Medium' | 'High'

export type SOCDataset = {
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
  triageQueue: Array<{ key: string; title: string; squad: string; risk: Risk; status: string; ageDays: number }>
  recentActivity: Array<{ key: string; title: string; when: string; status: string }>
}

const JIRA_BASE = process.env.JIRA_BASE!
const JIRA_AUTH = process.env.JIRA_AUTH!
const RISK_FIELD = process.env.JIRA_RISK_LEVEL_FIELD || 'customfield_12345'
const CRITERION_LABEL = process.env.JIRA_CRITERION_LABEL || 'cs-criterio'
const SQUAD_SOURCE = (process.env.JIRA_SQUAD_SOURCE || 'component') as 'component' | 'label'
const SQUAD_LABEL_PREFIX = process.env.JIRA_SQUAD_LABEL_PREFIX || 'squad-'

function headers() {
  return { 'Authorization': JIRA_AUTH, 'Accept': 'application/json' }
}

async function jiraSearch(jql: string, fields: string[] = [], maxResults = 100, startAt = 0): Promise<any> {
  const url = `${JIRA_BASE}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}${fields.length ? `&fields=${fields.join(',')}` : ''}`
  const res = await fetch(url, { headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`Jira error ${res.status}`)
  return res.json()
}

function riskFromField(fields: any): Risk | undefined {
  const v = fields[RISK_FIELD]
  if (!v) return
  const s = (typeof v === 'string' ? v : v?.value || '').toLowerCase()
  if (s.includes('high')) return 'High'
  if (s.includes('medium')) return 'Medium'
  if (s.includes('low')) return 'Low'
  return
}

function pickSquad(fields: any): string {
  if (SQUAD_SOURCE === 'component') return fields.components?.[0]?.name || 'Unknown'
  const lab = (fields.labels || []).find((l: string) => l.startsWith(SQUAD_LABEL_PREFIX))
  return lab ? lab.replace(SQUAD_LABEL_PREFIX, '') : 'Unknown'
}

export async function getSOCDataset(period: PeriodKey): Promise<SOCDataset> {
  const timeJQL =
    period === '30d' ? 'created >= -30d' :
    period === '90d' ? 'created >= -90d' : 'created >= startOfYear()'

  // Estados de ejemplo – AJUSTA a tu flujo:
  // Pendiente: statusCategory = "To Do"
  // En progreso: statusCategory = "In Progress"
  // Revisión: status in ("In Review","Code Review","Security Review")
  // Bloqueado: status = "Blocked"
  // Priorizar: labels = priority-needed (o usa un campo custom)
  const base = `${timeJQL} AND resolution = EMPTY`
  const fields = ['summary','status','labels','components','created','updated',RISK_FIELD]

  const [search] = await Promise.all([
    jiraSearch(`${base} ORDER BY created DESC`, fields, 100, 0),
  ])

  const issues = search.issues || []
  let pending=0,inProgress=0,review=0,blocked=0,prioritize=0, totalOpen=issues.length
  let low=0, med=0, high=0

  const triage: SOCDataset['triageQueue'] = []
  const recent: SOCDataset['recentActivity'] = []

  for (const it of issues.slice(0, 12)) {
    recent.push({
      key: it.key,
      title: it.fields.summary || '',
      when: 'reciente',
      status: it.fields.status?.name || '',
    })
  }

  for (const it of issues) {
    const sname = (it.fields.status?.statusCategory?.name || it.fields.status?.name || '').toLowerCase()
    if (sname.includes('to do')) pending++
    else if (sname.includes('in progress')) inProgress++
    else if (sname.includes('review')) review++
    else if (sname.includes('block')) blocked++
    else pending++

    if ((it.fields.labels || []).includes('priority-needed')) prioritize++

    const r = riskFromField(it.fields)
    if (r === 'Low') low++
    if (r === 'Medium') med++
    if (r === 'High') high++

    // Cola de triage simple
    if ((it.fields.labels || []).includes('priority-needed') || sname.includes('to do')) {
      const created = new Date(it.fields.created)
      const ageDays = Math.max(1, Math.round((Date.now() - created.getTime()) / 86400000))
      triage.push({
        key: it.key,
        title: it.fields.summary || '',
        squad: pickSquad(it.fields),
        risk: r || 'Low',
        status: it.fields.status?.name || 'To Do',
        ageDays
      })
    }
  }

  // Mock para backlogTrend / riskStackedByWeek si no quieres calcular aún
  const backlogTrend = [
    { date: 'W-4', open: Math.max(0, totalOpen - 7) },
    { date: 'W-3', open: Math.max(0, totalOpen - 5) },
    { date: 'W-2', open: Math.max(0, totalOpen - 4) },
    { date: 'W-1', open: Math.max(0, totalOpen - 1) },
    { date: 'W-0', open: totalOpen },
  ]
  const riskStackedByWeek = [
    { week: 'W-4', Low: Math.round(low*0.22), Medium: Math.round(med*0.20), High: Math.round(high*0.18) },
    { week: 'W-3', Low: Math.round(low*0.21), Medium: Math.round(med*0.22), High: Math.round(high*0.20) },
    { week: 'W-2', Low: Math.round(low*0.20), Medium: Math.round(med*0.20), High: Math.round(high*0.20) },
    { week: 'W-1', Low: Math.round(low*0.19), Medium: Math.round(med*0.18), High: Math.round(high*0.21) },
    { week: 'W-0', Low: Math.max(0, low - (low*0.82|0)), Medium: Math.max(0, med - (med*0.80|0)), High: Math.max(0, high - (high*0.79|0)) },
  ]

  const bubbleNodes = [
    { id: 'auth', label: 'Auth', value: Math.round(totalOpen*0.12) || 1 },
    { id: 'payments', label: 'Payments', value: Math.round(totalOpen*0.2) || 1 },
    { id: 'mobile', label: 'Mobile', value: Math.round(totalOpen*0.11) || 1 },
    { id: 'platform', label: 'Platform', value: Math.round(totalOpen*0.14) || 1 },
    { id: 'growth', label: 'Growth', value: Math.round(totalOpen*0.1) || 1 },
    { id: 'content', label: 'Content', value: Math.round(totalOpen*0.07) || 1 },
    { id: 'xchan', label: 'X-Channel', value: Math.round(totalOpen*0.09) || 1 },
  ]

  const data: SOCDataset = {
    kpis: {
      totalOpen,
      pending, inProgress, review, blocked, prioritize,
      slaBreached: Math.round(totalOpen * 0.05), // TODO: calcula de SLA reales
      mttrDays: 3.2,   // TODO: calcula según resueltas en periodo
      mttaHours: 5.6,  // TODO: calcula según primer transición
    },
    statusDistribution: [
      { name: 'Pendiente', value: pending },
      { name: 'En progreso', value: inProgress },
      { name: 'Revisión', value: review },
      { name: 'Bloqueado', value: blocked },
      { name: 'Priorizar', value: prioritize },
    ],
    riskDistribution: [
      { name: 'Low', value: low },
      { name: 'Medium', value: med },
      { name: 'High', value: high },
    ],
    backlogTrend,
    riskStackedByWeek,
    bubbleNodes,
    triageQueue: triage.slice(0, 12),
    recentActivity: recent,
  }

  return data
}

