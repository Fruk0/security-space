'use client'

import React, { useMemo, useState, useEffect } from 'react'
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
import ReactMarkdown from 'react-markdown'
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, Pencil } from 'lucide-react'

import { loadCriteria, loadFramework, loadLevels } from '@/lib/security/policy'
import type { QA, CriterionDef, CriterionAnswers, DecisionStatus, DecisionLabel } from '@/lib/security/domain'
import { evalCriterion, evalFramework } from '@/lib/security/engine'
import { isValidJiraKey } from '@/lib/security/validators'
import { writeClipboard } from '@/lib/security/clipboard'
import { buildPayload, buildCommentForCriterion, buildCommentForFramework, buildReviewCommentForCriterion } from '@/lib/security/jira'

/* =======================
 * Carga de políticas
 * ===================== */
const CRITERIA: CriterionDef[] = loadCriteria()
const FRAMEWORK = loadFramework()
const LEVELS = loadLevels()

// Base de Jira (definila en .env.local como NEXT_PUBLIC_JIRA_BASE_URL=https://tu-org.atlassian.net)
const JIRA_BASE = process.env.NEXT_PUBLIC_JIRA_BASE_URL

const badgeColor = (label: DecisionLabel) =>
  cn(
    'text-white',
    label === 'PENDIENTE' && 'bg-gray-400',
    label === 'PASA' && 'bg-emerald-600',
    label === 'REVISAR' && 'bg-amber-600',
    (label === 'NO APLICA' || label === 'NO PASA') && 'bg-rose-600'
  )

const displayLabel = (label: DecisionLabel): string =>
  label === 'NO PASA' ? 'NO APLICA' : label

export default function SecuritySpaceRiskCalculator() {
  // Estado base
  const [jiraKey, setJiraKey] = useState('')
  const [ticketConfirmed, setTicketConfirmed] = useState(false)
  const [criterionPass, setCriterionPass] = useState<DecisionStatus>('pending')
  const [answers, setAnswers] = useState<Record<string, QA>>({})
  const [notes, setNotes] = useState('')

  // Estado criterios
  const [critAnswers, setCritAnswers] = useState<Record<string, QA>>({})
  const [selectedCriterionId, setSelectedCriterionId] = useState<string | null>(null)
  const [critJustifications, setCritJustifications] = useState<Record<string, string>>({})
  const [acceptedCriterionId, setAcceptedCriterionId] = useState<string | null>(null)

  // Revisión solicitada + snapshots
  const [criterionReviewRequested, setCriterionReviewRequested] = useState(false)
  const [reviewSnapshot, setReviewSnapshot] = useState<{
    def: CriterionDef
    answers: Record<string, QA>
    justifications: Record<string, string>
  } | null>(null)

  const [acceptedSnapshot, setAcceptedSnapshot] = useState<{
    def: CriterionDef
    answers: Record<string, QA>
    justifications: Record<string, string>
  } | null>(null)

  // Feedback copiar
  const [copiedJSON, setCopiedJSON] = useState<null | 'ok' | 'err'>(null)
  const [copiedComment, setCopiedComment] = useState<null | 'ok' | 'err'>(null)
  const [copiedKey, setCopiedKey] = useState<null | 'ok' | 'err'>(null)

  // Limpieza de respuestas/justificaciones al cambiar de criterio
  useEffect(() => {
    setCritAnswers({})
    setCritJustifications({})
  }, [selectedCriterionId])

  // Estado derivado: criterio seleccionado
  const getCriterion = (id: string | null): CriterionDef | null =>
    id ? (CRITERIA.find(c => c.id === id) ?? null) : null

  const selectedCriterion = getCriterion(selectedCriterionId)
  const acceptedCriterion = getCriterion(acceptedCriterionId)

  const selectedEval = useMemo(() => {
    if (!selectedCriterion) return { status: 'pending' as DecisionStatus, label: 'PENDIENTE' as DecisionLabel, allYes: false }
    return evalCriterion(selectedCriterion, critAnswers as CriterionAnswers)
  }, [selectedCriterion, critAnswers])

  const selectedReadyToAccept = useMemo(() => {
    if (!selectedCriterion || selectedEval.status !== 'pass') return false
    // Justificación requerida solo cuando Aplica y la pregunta lo pide
    return selectedCriterion.questions.every(q => {
      if (critAnswers[q.id] !== 'yes') return true
      if (!q.requiresJustificationWhen?.includes('yes')) return true
      return !!critJustifications[q.id]?.trim()
    })
  }, [selectedCriterion, selectedEval.status, critAnswers, critJustifications])

  // Progreso del criterio (sticky)
  const critAnsweredCount = useMemo(() => {
    if (!selectedCriterion) return 0
    return selectedCriterion.questions.reduce((acc, q) => acc + (critAnswers[q.id] ? 1 : 0), 0)
  }, [selectedCriterion, critAnswers])

  const critProgressPct = useMemo(() => {
    if (!selectedCriterion) return 0
    return Math.round((critAnsweredCount / selectedCriterion.questions.length) * 100)
  }, [selectedCriterion, critAnsweredCount])

  // Framework derivado
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const frameworkEval = evalFramework(FRAMEWORK, LEVELS, answers)
  const { score, level, allAnswered } = frameworkEval
  const levelColor = useMemo(() => LEVELS.find(l => l.key === level)?.color ?? 'bg-emerald-500', [level])
  const progressPct = useMemo(() => Math.round((answeredCount / FRAMEWORK.questions.length) * 100), [answeredCount])

  const showFramework = ticketConfirmed && criterionPass === 'fail'
  const frameworkReady = ticketConfirmed && (criterionPass === 'fail') && allAnswered

  // --- UI: visibilidad del paso de ejecución (después de frameworkReady)
  const [showExecution, setShowExecution] = useState(false)
  const canShowExecution =
    ticketConfirmed && (criterionPass === 'pass' || (criterionPass === 'fail' && frameworkReady))

  useEffect(() => {
    if (canShowExecution) setShowExecution(true)
  }, [canShowExecution])

  // Acciones visibles solo con decisión lista (y sin un criterio abierto)
  const decisionReady = useMemo(() => {
    if (!ticketConfirmed) return false
    if (criterionPass === 'pass') return true
    if (criterionPass === 'fail') return frameworkReady
    return false
  }, [ticketConfirmed, criterionPass, frameworkReady])

  const showActions = useMemo(() => {
    if (!ticketConfirmed) return false
    if (selectedCriterion) return false
    return decisionReady
  }, [ticketConfirmed, selectedCriterion, decisionReady])

  // Flecha “volver”
  const showBack = useMemo(
    () => ticketConfirmed && (selectedCriterion || criterionPass === 'fail' || showExecution),
    [ticketConfirmed, selectedCriterion, criterionPass, showExecution]
  )

  // Helpers / Actions
  const isJiraKeyValid = isValidJiraKey(jiraKey)
  const setCritAnswer = (qid: string, val: QA) => setCritAnswers(prev => ({ ...prev, [qid]: val }))
  const setAnswer = (qid: string, val: QA) => setAnswers(prev => ({ ...prev, [qid]: val }))

  const jiraUrl = useMemo(
    () => (JIRA_BASE && jiraKey ? `${JIRA_BASE.replace(/\/+$/, '')}/browse/${jiraKey}` : null),
    [jiraKey]
  )

  async function copyTicketKey() {
    const ok = await writeClipboard(jiraKey)
    setCopiedKey(ok ? 'ok' : 'err')
    setTimeout(() => setCopiedKey(null), 1200)
  }

  function resetAll() {
    setAnswers({})
    setNotes('')
    setCriterionPass('pending')
    setCritAnswers({})
    setCritJustifications({})
    setSelectedCriterionId(null)
    setAcceptedCriterionId(null)
    setTicketConfirmed(false)
    setCriterionReviewRequested(false)
    setReviewSnapshot(null)
    setAcceptedSnapshot(null)
    setShowExecution(false)
  }

  // === Flecha "Volver" contextual ===
  function handleBack() {
    if (selectedCriterion) {
      setSelectedCriterionId(null)
      return
    }
    if (showExecution) {
      if (criterionPass === 'fail') {
        setShowExecution(false)
        return
      }
      if (criterionPass === 'pass') {
        setCriterionPass('pending')
        setAcceptedCriterionId(null)
        setAcceptedSnapshot(null)
        return
      }
    }
    if (ticketConfirmed && criterionPass === 'fail') {
      setCriterionPass('pending')
      return
    }
  }

  async function copyPayload() {
    const mode: 'criterion' | 'framework' | 'pending' =
      criterionPass === 'pass' ? 'criterion' :
      criterionPass === 'fail' ? 'framework' : 'pending'

    const payload = buildPayload({
      ticket: jiraKey,
      mode,
      criterion: mode === 'criterion' && acceptedCriterion ? {
        def: acceptedCriterion,
        answers: critAnswers,
        justifications: critJustifications
      } : undefined,
      framework: mode === 'framework' ? {
        def: FRAMEWORK,
        answers,
        score,
        level,
        allAnswered
      } : undefined,
      notes
    })

    const ok = await writeClipboard(JSON.stringify(payload, null, 2))
    setCopiedJSON(ok ? 'ok' : 'err')
    setTimeout(() => setCopiedJSON(null), 1500)
  }

  async function copyJiraComment() {
    let text = ''
    if (criterionPass === 'pass' && (acceptedSnapshot || acceptedCriterion)) {
      const def = acceptedSnapshot?.def ?? acceptedCriterion!
      const ans = acceptedSnapshot?.answers ?? critAnswers
      const jus = acceptedSnapshot?.justifications ?? critJustifications
      text = buildCommentForCriterion(def, ans, jus, notes)
    } else if (criterionReviewRequested && reviewSnapshot) {
      text = buildReviewCommentForCriterion(
        reviewSnapshot.def,
        reviewSnapshot.answers,
        reviewSnapshot.justifications,
        notes
      )
    } else if (criterionPass === 'fail') {
      text = buildCommentForFramework(FRAMEWORK, answers, score, level, allAnswered, notes)
    } else {
      text = 'Aún no hay una decisión registrada.'
    }

    const ok = await writeClipboard(text)
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
          {showBack && (
            <div className="mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                title="Volver"
                aria-label="Volver"
                className="px-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </div>
          )}

          <CardTitle className="text-2xl">SRO (Security Risk Orchestration)</CardTitle>
          <CardDescription>
            {ticketConfirmed
              ? 'Seleccioná un criterio (si aplica) o continuá con el framework de riesgo.'
              : 'Confirmá el ticket. Luego, opcionalmente elegí un criterio (si aplica) o pasá directo al framework de riesgo.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Ticket */}
          {!ticketConfirmed ? (
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
                Confirmar ticket
              </Button>
            </div>
          ) : (
            <div className="rounded-md border bg-muted/40 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <div className="leading-tight">
                  <div className="text-xs text-muted-foreground">Ticket confirmado</div>
                  <div className="font-semibold tracking-tight">
                    <span className="font-mono">{jiraKey}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyTicketKey}
                  title="Copiar KEY"
                  aria-label="Copiar KEY"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copiedKey === 'ok' ? 'Copiado' : 'Copiar'}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  disabled={!jiraUrl}
                  title={jiraUrl ? 'Abrir en Jira' : 'Configura NEXT_PUBLIC_JIRA_BASE_URL'}
                  aria-label="Abrir en Jira"
                >
                  <a href={jiraUrl ?? '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir
                  </a>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetAll}
                  title="Cambiar ticket"
                  aria-label="Cambiar ticket"
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Cambiar
                </Button>
              </div>
            </div>
          )}

          {/* Criterios (opcional) mientras no se eligió flujo */}
          {ticketConfirmed && criterionPass === 'pending' && !criterionReviewRequested && (
            <div className="space-y-4">
              {!selectedCriterion ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Criterios (opcional)</h3>
                      <p className="text-sm text-muted-foreground">
                        Si alguno aplica, seleccioná el criterio para responder sus afirmaciones. Si no aplica, salteá al framework.
                      </p>
                    </div>
                    <Button
                      variant="default"
                      onClick={() => {
                        setCriterionPass('fail')
                        setSelectedCriterionId(null)
                        setAcceptedCriterionId(null)
                        setCriterionReviewRequested(false)
                        setReviewSnapshot(null)
                      }}
                    >
                      No aplica / Ir al framework
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {CRITERIA.map((c) => (
                      <Card key={c.id} className="border">
                        <CardHeader className="py-4">
                          <CardTitle className="text-base">{c.title}</CardTitle>
                          {c.description && <CardDescription>{c.description}</CardDescription>}
                        </CardHeader>
                        <CardContent className="flex items-center justify-between pt-0">
                          <Button variant="secondary" onClick={() => setSelectedCriterionId(c.id)}>Usar este criterio</Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-lg font-semibold">{selectedCriterion.title}</h3>
                      {selectedCriterion.description && (
                        <p className="text-sm text-muted-foreground break-words">
                          {selectedCriterion.description}
                        </p>
                      )}
                    </div>
                    <Badge className={cn('shrink-0', badgeColor(selectedEval.label))}>
                      {displayLabel(selectedEval.label)}
                    </Badge>
                  </div>

                  {/* Preguntas del criterio seleccionado */}
                  <div className="space-y-3">
                    {selectedCriterion.questions.map((q) => (
                      <div key={q.id} className="flex flex-col gap-2 border rounded-lg p-3">
                        <div className="prose prose-sm dark:prose-invert font-medium">
                          <ReactMarkdown>{String(q.text ?? '')}</ReactMarkdown>
                        </div>

                        <RadioGroup
                          className="flex gap-6"
                          value={critAnswers[q.id] ?? ''}
                          onValueChange={(v: string) => setCritAnswer(q.id, v as QA)}
                        >
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
                        {critAnswers[q.id] === 'yes' && q.requiresJustificationWhen?.includes('yes') && (
                          <div className="mt-2">
                            <Label htmlFor={`${q.id}-crit-just`} className="text-xs">Justificación</Label>
                            <Textarea
                              id={`${q.id}-crit-just`}
                              placeholder="Explicá brevemente por qué aplica…"
                              value={critJustifications[q.id] ?? ''}
                              onChange={(e) => setCritJustifications(prev => ({ ...prev, [q.id]: e.target.value }))}
                              className={cn('min-h-[32px] py-1 text-sm', !critJustifications[q.id]?.trim() && 'ring-1 ring-rose-500')}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botonera dinámica */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => setSelectedCriterionId(null)} variant="secondary">Volver a criterios</Button>

                    <Button
                      onClick={() => {
                        if (!selectedCriterion) return

                        if (selectedReadyToAccept) {
                          setAcceptedSnapshot({
                            def: selectedCriterion,
                            answers: { ...critAnswers },
                            justifications: { ...critJustifications }
                          })
                          setAcceptedCriterionId(selectedCriterion.id)
                          setCriterionPass('pass')
                          setSelectedCriterionId(null)
                          setCriterionReviewRequested(false)
                          setReviewSnapshot(null)
                          return
                        }

                        if (selectedEval.label === 'REVISAR') {
                          const answered = Object.keys(critAnswers).length > 0
                          if (!answered) return
                          setCriterionReviewRequested(true)
                          setReviewSnapshot({
                            def: selectedCriterion,
                            answers: { ...critAnswers },
                            justifications: { ...critJustifications }
                          })
                          setSelectedCriterionId(null)
                          return
                        }

                        setCriterionPass('fail')
                        setSelectedCriterionId(null)
                        setAcceptedCriterionId(null)
                        setCriterionReviewRequested(false)
                        setReviewSnapshot(null)
                      }}
                      className={cn(
                        selectedReadyToAccept && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                        !selectedReadyToAccept && selectedEval.label === 'REVISAR' && 'bg-amber-600 hover:bg-amber-700 text-white'
                      )}
                      variant={selectedReadyToAccept ? 'default' : (selectedEval.label === 'REVISAR' ? 'default' : 'destructive')}
                    >
                      {selectedReadyToAccept
                        ? 'Aceptar por criterio'
                        : (selectedEval.label === 'REVISAR' ? 'Solicitar revisión de criterio' : 'Descartar e ir al framework')}
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
                  <span className="text-sm">Ticket aceptado por <strong>criterio de ciberseguridad</strong>.</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mensaje Revisión solicitada por criterio */}
          {ticketConfirmed && criterionPass === 'pending' && criterionReviewRequested && (
            <Card className="border border-amber-600/40 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-600 text-white">Revisión solicitada</Badge>
                    <span className="text-sm">
                      Se requiere <strong>revisión del criterio de ciberseguridad</strong>.
                    </span>
                  </div>
                  <Button onClick={copyJiraComment} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                    {copiedComment === 'ok' ? 'Copiado' : copiedComment === 'err' ? 'Error ❌' : 'Copiar comentario Jira'}
                  </Button>
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
                {FRAMEWORK.questions.map((q) => (
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

          {/* Sticky de criterio (en vivo) */}
          {ticketConfirmed && criterionPass === 'pending' && selectedCriterion && (
            <div className="fixed bottom-6 right-6 z-50">
              <Card className="shadow-xl border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Badge className={cn('text-white', badgeColor(selectedEval.label))}>
                      {displayLabel(selectedEval.label)}
                    </Badge>
                    <span className="font-semibold text-sm truncate max-w-[220px]">
                      {selectedCriterion.title}
                    </span>
                    {selectedEval.label === 'REVISAR' && (
                      <span className="ml-auto text-xs text-amber-700 dark:text-amber-300 font-medium">Requiere revisión</span>
                    )}
                    {selectedReadyToAccept && (
                      <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                        Listo para aceptar
                      </span>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {critAnsweredCount}/{selectedCriterion.questions.length} respondidas
                  </div>
                  <Progress value={critProgressPct} className="mt-1" />
                </CardContent>
              </Card>
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
                    {answeredCount}/{FRAMEWORK.questions.length} respondidas
                  </div>
                  <Progress value={progressPct} className="mt-2" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Acciones */}
          {showActions && (
            <>
              <div className="flex flex-wrap gap-3">
                <Button onClick={copyPayload}>
                  {copiedJSON === 'ok' ? 'Copiado' : copiedJSON === 'err' ? 'Error ❌' : 'Copiar payload JSON'}
                </Button>
                <Button onClick={copyJiraComment}>
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
