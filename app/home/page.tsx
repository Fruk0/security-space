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

import { loadCriteria, loadFramework, loadLevels } from '@/lib/security/policy'
import type { QA, CriterionDef, CriterionAnswers, DecisionStatus, DecisionLabel } from '@/lib/security/domain'
import { evalCriterion, evalFramework } from '@/lib/security/engine'
import { isValidJiraKey } from '@/lib/security/validators'
import { writeClipboard } from '@/lib/security/clipboard'
import { buildPayload, buildCommentForCriterion, buildCommentForFramework } from '@/lib/security/jira'

/* =======================
 * Carga de políticas
 * ===================== */
const CRITERIA: CriterionDef[] = loadCriteria()
const FRAMEWORK = loadFramework()
const LEVELS = loadLevels()

const badgeColor = (label: DecisionLabel) =>
  cn(
    'text-white',
    label === 'PENDIENTE' && 'bg-gray-400',
    label === 'PASA' && 'bg-emerald-600',
    label === 'REVISAR' && 'bg-amber-600',
    label === 'NO PASA' && 'bg-rose-600'
  )

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

  // Feedback copiar
  const [copiedJSON, setCopiedJSON] = useState<null | 'ok' | 'err'>(null)
  const [copiedComment, setCopiedComment] = useState<null | 'ok' | 'err'>(null)

  // Validación KEY Jira
  const isJiraKeyValid = isValidJiraKey(jiraKey)

  // Helpers
  const getCriterion = (id: string | null): CriterionDef | null =>
    id ? (CRITERIA.find(c => c.id === id) ?? null) : null

  const selectedCriterion = getCriterion(selectedCriterionId)
  const acceptedCriterion = getCriterion(acceptedCriterionId)

  // Estado derivado: criterio seleccionado
  const selectedEval = useMemo(() => {
    if (!selectedCriterion) return { status: 'pending' as DecisionStatus, label: 'PENDIENTE' as DecisionLabel, allYes: false }
    return evalCriterion(selectedCriterion, critAnswers as CriterionAnswers)
  }, [selectedCriterion, critAnswers])

  const selectedReadyToAccept = useMemo(() => {
    if (!selectedCriterion || selectedEval.status !== 'pass') return false
    // justificación requerida cuando la respuesta es 'yes'
    return selectedCriterion.questions.every(q => {
      if (critAnswers[q.id] !== 'yes') return true
      if (!q.requiresJustificationWhen?.includes('yes')) return true
      return !!critJustifications[q.id]?.trim()
    })
  }, [selectedCriterion, selectedEval.status, critAnswers, critJustifications])

  // Framework derivado
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers])
  const frameworkEval = evalFramework(FRAMEWORK, LEVELS, answers)
  const { score, level, allAnswered } = frameworkEval
  const levelColor = useMemo(() => LEVELS.find(l => l.key === level)?.color ?? 'bg-emerald-500', [level])
  const progressPct = useMemo(() => Math.round((answeredCount / FRAMEWORK.questions.length) * 100), [answeredCount])

  const showFramework = ticketConfirmed && criterionPass === 'fail'
  const frameworkReady = ticketConfirmed && (criterionPass === 'fail') && allAnswered

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
    setSelectedCriterionId(null); setAcceptedCriterionId(null)
    setTicketConfirmed(false)
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
    if (criterionPass === 'pass' && acceptedCriterion) {
      text = buildCommentForCriterion(acceptedCriterion, critAnswers, critJustifications, notes)
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
                      onClick={() => { setCriterionPass('fail'); setSelectedCriterionId(null); setAcceptedCriterionId(null) }}
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
                      {selectedEval.label}
                    </Badge>
                  </div>

                  {/* Preguntas del criterio seleccionado */}
                  <div className="space-y-3">
                    {selectedCriterion.questions.map((q) => (
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
                        {critAnswers[q.id] === 'yes' && q.requiresJustificationWhen?.includes('yes') && (
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
                    <Button onClick={() => setSelectedCriterionId(null)} variant="secondary">Volver a criterios</Button>
                    <Button
                      onClick={() => { setCriterionPass('fail'); setSelectedCriterionId(null); setAcceptedCriterionId(null) }}
                      variant="destructive"
                    >
                      Descartar e ir al framework
                    </Button>
                    <Button
                      onClick={() => {
                        if (!selectedCriterion) return
                        setAcceptedCriterionId(selectedCriterion.id)
                        setCriterionPass('pass')
                        setSelectedCriterionId(null)
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
