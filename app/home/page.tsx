'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/* =========================================================
 * Tipos
 * ======================================================= */
type CriterionGroupKey = 'C1' | 'C2' | 'C3' | 'C4'
type QA = 'yes' | 'no' | 'unknown'
type DecisionStatus = 'pending' | 'pass' | 'fail'
type DecisionLabel = 'PENDIENTE' | 'PASA' | 'REVISAR' | 'NO PASA'

type CriterionQuestion = { id: string; group: CriterionGroupKey; text: string }
type Q = {
  id: string
  text: string
  type: 'yes_no_unknown'
  weight: number
  riskType: string
  riskWhen?: 'yes' | 'no' | 'unknown' | 'yes_or_unknown' | 'no_or_unknown'
}

/* =========================================================
 * Constantes (Criterios + Framework)
 * ======================================================= */
const CRITERIA_GROUPS: Record<CriterionGroupKey, { title: string; description?: string }> = {
  C1: {
    title: 'Criterio 1 – PATCH en servicio previamente validado',
    description:
      'Cambios mínimos en el código (ej: logs, refactors, cambios de dependencias) sin impacto en lógica de negocio ni entidades de entrada/salida, sobre servicios ya revisados por Ciber en versiones anteriores.',
  },
  C2: {
    title: 'Criterio 2 – Contenido público accedido vía Contentful',
    description:
      'Servicios que consultan exclusivamente contenido público (FAQs, legales, beneficios, banners), sin requerir autenticación ni permitir modificación de datos.',
  },
  C3: {
    title: 'Criterio 3 – Procesos batch internos sin impacto crítico',
    description:
      'Procesos batch ejecutados en backend, que no exponen endpoints y no operan sobre dinero o datos sensibles de cuenta.',
  },
  C4: {
    title: 'Criterio 4 – Servicios sin cambios en capa canal',
    description:
      'Servicios que ya fueron evaluados y no presentan cambios ni en versiones, ni en contratos de entrada/salida.',
  },
}

const CRITERION_QUESTIONS: CriterionQuestion[] = [
  // C1
  { id: 'c1_q1', group: 'C1', text: '¿El cambio es únicamente de tipo PATCH (ej: versión 1.2.3 → 1.2.4)?' },
  { id: 'c1_q2', group: 'C1', text: '¿El cambio mantiene sin modificaciones entidades, validaciones, lógica de negocio y endpoints?' },
  { id: 'c1_q3', group: 'C1', text: '¿El servicio ya fue validado previamente por Ciberseguridad?' },
  { id: 'c1_q4', group: 'C1', text: '¿El servicio está limitado a uso interno, sin exposición directa a usuarios externos?' },
  { id: 'c1_q5', group: 'C1', text: '¿El cambio evita acceso o transformación de datos sensibles?' },

  // C2
  { id: 'c2_q1', group: 'C2', text: '¿El servicio utiliza exclusivamente el método GET?' },
  { id: 'c2_q2', group: 'C2', text: '¿El contenido proviene únicamente de Contentful/CDN público?' },
  { id: 'c2_q3', group: 'C2', text: '¿El servicio funciona sin autenticación ni tokens?' },
  { id: 'c2_q4', group: 'C2', text: '¿El servicio expone únicamente datos públicos no sensibles?' },

  // C3
  { id: 'c3_q1', group: 'C3', text: '¿Se trata de un proceso batch o job interno (por ejemplo, cron o ejecutable)?' },
  { id: 'c3_q2', group: 'C3', text: '¿Se ejecuta en capas internas (por ejemplo, BLR), sin exposición por canal?' },
  { id: 'c3_q3', group: 'C3', text: '¿No accede ni transforma datos de cuentas, tokens o transacciones?' },
  { id: 'c3_q4', group: 'C3', text: '¿No interactúa con APIs externas ni consume credenciales?' },

  // C4
  { id: 'c4_q1', group: 'C4', text: '¿El servicio mantiene sin cambios la versión, el contrato y la lógica?' },
  { id: 'c4_q2', group: 'C4', text: '¿No se agregan nuevos parámetros, headers ni operaciones?' },
  { id: 'c4_q3', group: 'C4', text: '¿El servicio ya fue validado previamente por Ciberseguridad?' },
]

const QUESTIONS: Q[] = [
  { id: 'q1', text: '¿Este cambio crea o modifica un endpoint o ruta accesible?', type: 'yes_no_unknown', weight: 1, riskType: 'Superficie nueva', riskWhen: 'yes' },
  { id: 'q2', text: '¿Es accesible desde Internet o por usuarios externos?', type: 'yes_no_unknown', weight: 2, riskType: 'Exposición externa', riskWhen: 'yes' },
  { id: 'q3', text: '¿Requiere login, token, JWT o manejo de sesión?', type: 'yes_no_unknown', weight: 1, riskType: 'Lógica de sesión', riskWhen: 'yes' },
  { id: 'q4', text: '¿Afecta control de roles, permisos o lógica de autorización?', type: 'yes_no_unknown', weight: 2, riskType: 'Autorización / acceso', riskWhen: 'yes' },
  { id: 'q5', text: '¿Procesa o expone datos sensibles (PII, credenciales, financieros)?', type: 'yes_no_unknown', weight: 3, riskType: 'Confidencialidad', riskWhen: 'yes' },
  { id: 'q6', text: '¿Permite operaciones críticas (altas, bajas, transferencias, privilegios)?', type: 'yes_no_unknown', weight: 3, riskType: 'Impacto funcional', riskWhen: 'yes' },
  { id: 'q7', text: '¿Recibe entradas complejas (uploads, URLs, archivos, input libre)?', type: 'yes_no_unknown', weight: 2, riskType: 'Riesgo de entrada', riskWhen: 'yes' },
  { id: 'q8', text: '¿Valida correctamente todas las entradas en backend?', type: 'yes_no_unknown', weight: 2, riskType: 'Ausencia de validación', riskWhen: 'no_or_unknown' },
  { id: 'q9', text: '¿Consume APIs externas, SDKs o servicios nuevos?', type: 'yes_no_unknown', weight: 1, riskType: 'Integración externa', riskWhen: 'yes' },
  { id: 'q10', text: '¿Requiere configuración, secretos o acceso a infraestructura?', type: 'yes_no_unknown', weight: 2, riskType: 'Config / secretos', riskWhen: 'yes' },
  { id: 'q11', text: '¿Maneja JWT, hashing, firmas o algoritmos criptográficos?', type: 'yes_no_unknown', weight: 2, riskType: 'Criptografía', riskWhen: 'yes' },
  { id: 'q12', text: '¿Introduce lógica de negocio nueva o modifica procesos existentes?', type: 'yes_no_unknown', weight: 2, riskType: 'Lógica personalizada', riskWhen: 'yes' },
  { id: 'q13', text: '¿Impacta múltiples capas o sistemas compartidos?', type: 'yes_no_unknown', weight: 1, riskType: 'Propagación', riskWhen: 'yes' },
  { id: 'q14', text: '¿Incluye logs de seguridad/monitoreo/alertas sobre la funcionalidad?', type: 'yes_no_unknown', weight: 1, riskType: 'Trazabilidad', riskWhen: 'no_or_unknown' },
]

const LEVELS = [
  { key: 'Low', min: 0, max: 5, color: 'bg-emerald-500' },
  { key: 'Medium', min: 6, max: 10, color: 'bg-amber-500' },
  { key: 'High', min: 11, max: 99, color: 'bg-rose-600' },
] as const

/* =========================================================
 * Helpers puros
 * ======================================================= */

// Helper robusto de portapapeles (con fallback + isSecureContext)
async function writeClipboard(text: string): Promise<boolean> {
  // Si no es contexto seguro, vamos directo al fallback
  if (!(window as any).isSecureContext || !navigator.clipboard?.writeText) {
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

  // Contexto seguro: usamos Clipboard API
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
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
}

type JustMap = Record<string, string>

const groupQuestions = (g: CriterionGroupKey) => CRITERION_QUESTIONS.filter(q => q.group === g)

const shouldCount = (riskWhen: Q['riskWhen'], a: QA | undefined) => {
  if (!a || !riskWhen) return false
  if (riskWhen === 'yes') return a === 'yes'
  if (riskWhen === 'no') return a === 'no'
  if (riskWhen === 'unknown') return a === 'unknown'
  if (riskWhen === 'no_or_unknown') return a === 'no' || a === 'unknown'
  if (riskWhen === 'yes_or_unknown') return a === 'yes' || a === 'unknown'
  return false
}

const badgeColor = (label: DecisionLabel) =>
  cn(
    'text-white',
    label === 'PENDIENTE' && 'bg-gray-400',
    label === 'PASA' && 'bg-emerald-600',
    label === 'REVISAR' && 'bg-amber-600',
    label === 'NO PASA' && 'bg-rose-600'
  )

const evalSingleCriterion = (
  answers: Record<string, QA>,
  group: CriterionGroupKey
): { status: DecisionStatus; label: DecisionLabel } => {
  const qs = groupQuestions(group)
  const answered = qs.filter(q => answers[q.id] !== undefined).length
  if (answered === 0) return { status: 'pending', label: 'PENDIENTE' }
  const allYes = qs.length > 0 && qs.every(q => answers[q.id] === 'yes')
  if (allYes) return { status: 'pass', label: 'PASA' }
  const hasUnknown = qs.some(q => answers[q.id] === 'unknown')
  const incomplete = answered < qs.length
  if (hasUnknown || incomplete) return { status: 'fail', label: 'REVISAR' }
  return { status: 'fail', label: 'NO PASA' }
}

/* =========================================================
 * Componente
 * ======================================================= */
export default function SecuritySpaceRiskCalculator() {
  // Estado base
  const [jiraKey, setJiraKey] = useState('')
  const [ticketConfirmed, setTicketConfirmed] = useState(false)
  const [criterionPass, setCriterionPass] = useState<DecisionStatus>('pending')
  const [answers, setAnswers] = useState<Record<string, QA>>({})
  const [notes, setNotes] = useState('')

  // Estado criterios
  const [critAnswers, setCritAnswers] = useState<Record<string, QA>>({})
  const [selectedCriterion, setSelectedCriterion] = useState<CriterionGroupKey | null>(null)
  const [critJustifications, setCritJustifications] = useState<JustMap>({})
  const [acceptedCriterion, setAcceptedCriterion] = useState<CriterionGroupKey | null>(null)

  // Feedback copiar
  const [copiedJSON, setCopiedJSON] = useState<null | 'ok' | 'err'>(null)
  const [copiedComment, setCopiedComment] = useState<null | 'ok' | 'err'>(null)

  // Validación KEY Jira
  const JIRA_KEY_RE = /^[A-Z]{1,4}-\d+$/
  const isJiraKeyValid = JIRA_KEY_RE.test(jiraKey.trim())

  // Derivados
  const selectedStatus = useMemo(
    () => (selectedCriterion ? evalSingleCriterion(critAnswers, selectedCriterion) : { status: 'pending', label: 'PENDIENTE' as const }),
    [critAnswers, selectedCriterion]
  )

  const selectedReadyToAccept = useMemo(() => {
    if (!selectedCriterion || selectedStatus.status !== 'pass') return false
    const qs = groupQuestions(selectedCriterion)
    return qs.every(q => (critAnswers[q.id] === 'yes') && !!critJustifications[q.id]?.trim())
  }, [selectedCriterion, selectedStatus.status, critAnswers, critJustifications])

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const score = useMemo(() => QUESTIONS.reduce((acc, q) => acc + (shouldCount(q.riskWhen, answers[q.id]) ? q.weight : 0), 0), [answers])
  const level = useMemo(() => LEVELS.find(l => score >= l.min && score <= l.max)?.key ?? 'Low', [score])
  const levelColor = useMemo(() => LEVELS.find(l => score >= l.min && score <= l.max)?.color ?? 'bg-emerald-500', [score])
  const progressPct = useMemo(() => Math.round((answeredCount / QUESTIONS.length) * 100), [answeredCount])

  const allFrameworkAnswered = useMemo(() => Object.keys(answers).length === QUESTIONS.length, [answers])
  const frameworkReady = ticketConfirmed && (criterionPass === 'fail') && allFrameworkAnswered
  const showFramework = ticketConfirmed && criterionPass === 'fail'

  // Habilita acciones de copia si pasaste por criterio o completaste el framework
  const decisionReady = useMemo(() => {
    if (!ticketConfirmed) return false
    if (criterionPass === 'pass') return true
    if (criterionPass === 'fail') return frameworkReady
    return false
  }, [ticketConfirmed, criterionPass, frameworkReady])

  // Actions
  const setCritAnswer = (qid: string, val: QA) => setCritAnswers(prev => ({ ...prev, [qid]: val }))
  const setAnswer = (qid: string, val: QA) => setAnswers(prev => ({ ...prev, [qid]: val }))

  function resetAll() {
    setAnswers({}); setNotes(''); setCriterionPass('pending')
    setCritAnswers({}); setCritJustifications({})
    setSelectedCriterion(null); setAcceptedCriterion(null)
    setTicketConfirmed(false)
  }

  // Copiar payload JSON
  async function copyPayload() {
    const rationale = QUESTIONS
      .filter(q => shouldCount(q.riskWhen, answers[q.id]))
      .map(q => ({ id: q.id, text: q.text, weight: q.weight, answer: answers[q.id] }))

    const payload = {
      ticket: jiraKey.trim(),
      decision: {
        mode: criterionPass === 'pass' ? 'criterion' : (criterionPass === 'fail' ? 'framework' : 'pending'),
        byCriterion: criterionPass === 'pass' ? {
          used: acceptedCriterion,
          title: acceptedCriterion ? CRITERIA_GROUPS[acceptedCriterion].title : null,
          answers: critAnswers,
          justifications: critJustifications,
        } : null,
        byFramework: criterionPass === 'fail' ? {
          score, level, answers, allAnswered: allFrameworkAnswered,
        } : null
      },
      notes,
      rationale,
      generatedAt: new Date().toISOString(),
    }

    const ok = await writeClipboard(JSON.stringify(payload, null, 2))
    setCopiedJSON(ok ? 'ok' : 'err')
    setTimeout(() => setCopiedJSON(null), 1500)
  }

  // Construir comentario para Jira
  function buildJiraComment(): string {
    if (criterionPass === 'pass' && acceptedCriterion) {
      const title = CRITERIA_GROUPS[acceptedCriterion].title
      const qs = groupQuestions(acceptedCriterion)
      const lines = qs
        .filter(q => critAnswers[q.id] === 'yes')
        .map(q => `- ${q.text}\n ${critJustifications[q.id] || '—'}`)
        .join('\n')
      return [
        `Solicito aplicar el **criterio de ciberseguridad**: ${title}.`,
        `Respuestas y justificaciones:`,
        lines || '—',
        notes ? `Notas: ${notes}` : ''
      ].filter(Boolean).join('\n\n')
    }

    const lines = QUESTIONS
      .filter(q => shouldCount(q.riskWhen, answers[q.id]))
      .map(q => `- ${q.text} ( +${q.weight} )\n  Respuesta: ${answers[q.id]}`)
      .join('\n')

    const completeness = allFrameworkAnswered
      ? 'Todas las preguntas del framework fueron respondidas.'
      : 'Aún hay preguntas sin responder.'

    return [
      `Solicito registrar el **Security Risk** calculado.`,
      `Nivel: **${level}** (${score} pts).`,
      completeness,
      `Respuestas que aportan riesgo:`,
      lines || '—',
      notes ? `Notas: ${notes}` : ''
    ].filter(Boolean).join('\n\n')
  }

  // Copiar comentario Jira
  async function copyJiraComment() {
    const ok = await writeClipboard(buildJiraComment())
    setCopiedComment(ok ? 'ok' : 'err')
    setTimeout(() => setCopiedComment(null), 1500)
  }

  /* ==========================================
   * Render
   * ======================================== */
  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Security Space – Risk Calculator (MVP)</CardTitle>
          <CardDescription>
            Confirmá el ticket. Luego, opcionalmente elegí un criterio (si aplica) o pasá directo al framework de riesgo.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Ticket */}
          <div className="grid gap-4 md:grid-cols-3 items-end">
            <div className="md:col-span-2">
              <Label htmlFor="jira">Ticket de Jira (KEY)</Label>
              <Input
                id="jira"
                placeholder="CS-123"
                value={jiraKey}
                onChange={e => setJiraKey(e.target.value.toUpperCase())}
                className={cn(!isJiraKeyValid && jiraKey ? 'ring-1 ring-rose-500' : '')}
              />
              {jiraKey && !isJiraKeyValid && (
                <p className="mt-1 text-xs text-rose-600">
                  Formato esperado: ABC-123 o ABCD-123 (máx 4 letras, guión y número).
                </p>
              )}
            </div>
            <Button variant="default" disabled={!isJiraKeyValid} onClick={() => setTicketConfirmed(true)}>
              {ticketConfirmed ? 'Ticket confirmado' : 'Confirmar ticket'}
            </Button>
          </div>

          <Separator />

          {/* Aviso si no está confirmado */}
          {!ticketConfirmed && (
            <Card className="border-amber-300/50 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-600 text-white">Pendiente</Badge>
                  <span className="text-sm">
                    Primero confirmá el <strong>ticket de Jira</strong> para continuar con criterios o framework.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Criterios (opcional) mientras no se eligió flujo */}
          {ticketConfirmed && criterionPass === 'pending' && (
            <div className="space-y-4">
              {!selectedCriterion ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Criterios (opcional)</h3>
                      <p className="text-sm text-muted-foreground">
                        Si alguno aplica, seleccioná el criterio para responder solo sus preguntas. Si no aplica, salteá al framework.
                      </p>
                    </div>
                    <Button
                      variant="default"
                      onClick={() => { setCriterionPass('fail'); setSelectedCriterion(null); setAcceptedCriterion(null) }}
                    >
                      No aplica / Ir al framework
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {(['C1','C2','C3','C4'] as CriterionGroupKey[]).map((g) => (
                      <Card key={g} className="border">
                        <CardHeader className="py-4">
                          <CardTitle className="text-base">{CRITERIA_GROUPS[g].title}</CardTitle>
                          {CRITERIA_GROUPS[g].description && <CardDescription>{CRITERIA_GROUPS[g].description}</CardDescription>}
                        </CardHeader>
                        <CardContent className="flex items-center justify-between pt-0">
                          <Button variant="secondary" onClick={() => setSelectedCriterion(g)}>Usar este criterio</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <>
                    <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                        <h3 className="text-lg font-semibold">{CRITERIA_GROUPS[selectedCriterion].title}</h3>
                        {CRITERIA_GROUPS[selectedCriterion].description && (
                        <p className="text-sm text-muted-foreground break-words">
                            {CRITERIA_GROUPS[selectedCriterion].description}
                        </p>
                        )}
                    </div>
                    <Badge className={cn('shrink-0', badgeColor(selectedStatus.label))}>
                        {selectedStatus.label}
                    </Badge>
                    </div>


                  {/* Preguntas del criterio seleccionado */}
                  <div className="space-y-3">
                    {groupQuestions(selectedCriterion).map((q) => (
                      <div key={q.id} className="flex flex-col gap-2 border rounded-lg p-3">
                        <span className="font-medium">{q.text}</span>
                        <RadioGroup className="flex gap-6" value={critAnswers[q.id] ?? ''} onValueChange={(v: string) => setCritAnswer(q.id, v as QA)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id={`${q.id}-yes`} value="yes" />
                            <Label htmlFor={`${q.id}-yes`}>Aplica</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id={`${q.id}-no`} value="no" />
                            <Label htmlFor={`${q.id}-no`}>No aplica</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id={`${q.id}-unknown`} value="unknown" />
                            <Label htmlFor={`${q.id}-unknown`}>Duda</Label>
                          </div>
                        </RadioGroup>

                        {/* Justificación obligatoria si Aplica */}
                        {critAnswers[q.id] === 'yes' && (
                          <div className="mt-2">
                            <Label htmlFor={`${q.id}-crit-just`} className="text-xs">Justificación</Label>
                            <Textarea
                              id={`${q.id}-crit-just`}
                              placeholder="Explicá brevemente por qué aplica…"
                              value={critJustifications[q.id] ?? ''}
                              onChange={(e) => setCritJustifications(prev => ({ ...prev, [q.id]: e.target.value }))}
                              className={cn('h-20', !critJustifications[q.id]?.trim() && 'ring-1 ring-rose-500')}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => setSelectedCriterion(null)} variant="secondary">Volver a criterios</Button>
                    <Button
                      onClick={() => { setCriterionPass('fail'); setSelectedCriterion(null); setAcceptedCriterion(null) }}
                      variant="destructive"
                    >
                      Descartar e ir al framework
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selectedCriterion) return
                        const used = selectedCriterion
                        setAcceptedCriterion(used)        // 1) guardo el criterio aceptado
                        setCriterionPass('pass')          // 2) marco que pasó por criterio
                        setSelectedCriterion(null)        // 3) limpio la vista de preguntas
                      }}
                      disabled={!selectedReadyToAccept}
                    >
                      Aceptar por criterio
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mensaje Aceptado por criterio */}
          {ticketConfirmed && criterionPass === 'pass' && (
            <Card className="border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-600 text-white">Aceptado</Badge>
                  <span className="text-sm">Ticket aceptado por <strong>criterio de ciberseguridad</strong>. No requiere scoring.</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Framework de riesgo */}
          {showFramework && (
            <div className="space-y-6">
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold">Framework de Security Risk</h3>
                  <p className="text-sm text-muted-foreground">Respondé Sí / No / No sé. El score se calcula automáticamente.</p>
                </div>
                <Badge className={cn('text-white', levelColor)}>{level} • {score} pts</Badge>
              </div>

              <Progress value={progressPct} />

              <div className="space-y-4">
                {QUESTIONS.map((q) => (
                  <Card key={q.id} className="border">
                    <CardContent className="pt-6">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{q.text}</span>
                          <Badge variant="secondary">{q.riskType} · +{q.weight}</Badge>
                        </div>

                        <RadioGroup className="flex gap-6" value={answers[q.id] ?? ''} onValueChange={(v: string) => setAnswer(q.id, v as QA)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id={`${q.id}-yes`} value="yes" />
                            <Label htmlFor={`${q.id}-yes`}>Sí</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id={`${q.id}-no`} value="no" />
                            <Label htmlFor={`${q.id}-no`}>No</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem id={`${q.id}-unknown`} value="unknown" />
                            <Label htmlFor={`${q.id}-unknown`}>No sé</Label>
                          </div>
                        </RadioGroup>

                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Score sticky (temporal/final) */}
          {ticketConfirmed && criterionPass === 'fail' && (
            <div className="fixed bottom-6 right-6 z-50">
              <Card className="shadow-xl border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Badge className={cn('text-white', levelColor)}>{level}</Badge>
                    <span className="font-semibold text-lg">{score} pts</span>
                    <span className="text-xs text-muted-foreground">{frameworkReady ? 'Riesgo FINAL' : 'Riesgo temporal'}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground text-right">
                    {answeredCount}/{QUESTIONS.length} respondidas
                  </div>
                  <Progress value={progressPct} className="mt-2" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Acciones */}
          {ticketConfirmed && (
            <>
              <div className="flex flex-wrap gap-3">
                <Button onClick={copyPayload} disabled={!decisionReady}>
                  {copiedJSON === 'ok' ? 'Copiado' : copiedJSON === 'err' ? 'Error ❌' : 'Copiar payload JSON'}
                </Button>
                <Button onClick={copyJiraComment} disabled={!decisionReady}>
                  {copiedComment === 'ok' ? 'Copiado' : copiedComment === 'err' ? 'Error ❌' : 'Copiar comentario Jira'}
                </Button>
                <Button variant="secondary" onClick={resetAll}>Reiniciar</Button>
              </div>

              <Separator />
              <div className="text-xs text-muted-foreground">
                MVP local. Próximo paso: endpoint backend que actualice Jira (labels, score, level, comentario con rationale).
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
