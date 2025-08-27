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
import TicketForm from '@/components/security/TicketForm'
import CriteriaSection from '@/components/security/CriteriaSection'
import CriteriaStatusCards from '@/components/security/CriteriaStatusCards'
import FrameworkSection from '@/components/security/FrameworkSection'
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
<TicketForm
  jiraKey={jiraKey}
  isJiraKeyValid={isJiraKeyValid}
  ticketConfirmed={ticketConfirmed}
  jiraUrl={jiraUrl}
  onChangeKey={(v) => setJiraKey(v.toUpperCase())}
  onConfirm={() => setTicketConfirmed(true)}
  onChangeTicket={resetAll}
  copyTicketKey={copyTicketKey}
  copiedKey={copiedKey}
/>
        {/* Criterios (opcional) mientras no se eligió flujo */}
        {ticketConfirmed && criterionPass === 'pending' && !criterionReviewRequested && (
          <div className="space-y-4">
            <CriteriaSection
              CRITERIA={CRITERIA}
              selectedCriterion={selectedCriterion}
              critAnswers={critAnswers}
              critJustifications={critJustifications}

              // Estos dos salen de tu lógica actual:
              selectedEvalLabel={displayLabel(selectedEval.label)}
              statusBadgeClass={cn('shrink-0', badgeColor(selectedEval.label))}
              selectedReadyToAccept={selectedReadyToAccept}

              // Acciones existentes en tu page:
              onGoToFramework={() => {
                setCriterionPass('fail')
                setSelectedCriterionId(null)
                setAcceptedCriterionId(null)
                setCriterionReviewRequested(false)
                setReviewSnapshot(null)
              }}
              onSelectCriterionId={(id) => setSelectedCriterionId(id)}
              onSetAnswer={(qid, v) => setCritAnswer(qid, v)}
              onSetJustification={(qid, txt) => setCritJustifications(prev => ({ ...prev, [qid]: txt }))}

              onAcceptByCriterion={(snap) => {
                setAcceptedSnapshot(snap)
                setAcceptedCriterionId(snap.def.id)
                setCriterionPass('pass')
                setSelectedCriterionId(null)
                setCriterionReviewRequested(false)
                setReviewSnapshot(null)
              }}
              onRequestReview={(snap) => {
                setCriterionReviewRequested(true)
                setReviewSnapshot(snap)
                setSelectedCriterionId(null)
              }}
              onDiscardToFramework={() => {
                setCriterionPass('fail')
                setSelectedCriterionId(null)
                setAcceptedCriterionId(null)
                setCriterionReviewRequested(false)
                setReviewSnapshot(null)
              }}
            />
          </div>
        )}
          <CriteriaStatusCards
            showAccepted={ticketConfirmed && criterionPass === 'pass'}
            showReviewRequested={ticketConfirmed && criterionPass === 'pending' && criterionReviewRequested}
            onCopyJiraComment={copyJiraComment}
            copiedComment={copiedComment}
          />

          {/* Framework de riesgo */}
          {showFramework && (
            <FrameworkSection
              FRAMEWORK={FRAMEWORK}
              level={level}
              score={score}
              levelColor={levelColor}
              progressPct={progressPct}
              answers={answers}
              onSetAnswer={(qid, v) => setAnswer(qid, v as QA)}
            />
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
