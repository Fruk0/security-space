'use client'

import React, { useMemo, useEffect, useReducer, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'

import TicketForm from '@/components/security/TicketForm'
import CriteriaSection from '@/components/security/CriteriaSection'
import CriteriaStatusCards from '@/components/security/CriteriaStatusCards'
import FrameworkSection from '@/components/security/FrameworkSection'

import { loadCriteria, loadFramework, loadLevels } from '@/lib/security/policy'
import type { QA, CriterionDef, DecisionLabel } from '@/lib/security/domain'
import { writeClipboard } from '@/lib/security/clipboard'
import {
  buildPayload,
  buildCommentForCriterion,
  buildCommentForFramework,
  buildReviewCommentForCriterion,
} from '@/lib/security/jira'

import { uiReducer, createInitialState, createUIActions } from '@/lib/security/state'
import {
  selectSelectedCriterion,
  selectAcceptedCriterion,
  selectSelectedEval,
  selectSelectedReadyToAccept,
  selectCriterionProgress,
  selectFrameworkEval,
  selectLevelColor,
  selectAnsweredCount,
  selectFrameworkProgress,
  selectShowFramework,
  selectFrameworkReady,
  selectCanShowExecution,
  selectDecisionReady,
  selectShowActions,
  selectShowBack,
  selectJiraUrl,
} from '@/lib/security/selectors'

import { useUrlSync } from '@/lib/security/url'
import { useFrameworkStorage, clearFrameworkStorage } from '@/lib/security/storage'

/* =======================
 * Carga de políticas
 * ===================== */
const CRITERIA: CriterionDef[] = loadCriteria()
const FRAMEWORK = loadFramework()
const LEVELS = loadLevels()

// Base de Jira (definila en .env.local como NEXT_PUBLIC_JIRA_BASE_URL=https://tu-org.atlassian.net)
const JIRA_BASE = process.env.NEXT_PUBLIC_JIRA_BASE_URL as string | undefined

const badgeColor = (label: DecisionLabel) =>
  cn(
    'text-white',
    label === 'PENDIENTE' && 'bg-gray-400',
    label === 'PASA' && 'bg-emerald-600',
    label === 'REVISAR' && 'bg-amber-600',
    (label === 'NO APLICA' || label === 'NO PASA') && 'bg-rose-600'
  )

const displayLabel = (label: DecisionLabel): string => (label === 'NO PASA' ? 'NO APLICA' : label)

export default function SecuritySpaceRiskCalculator() {
  // Reducer
  const [state, dispatch] = useReducer(uiReducer, undefined, createInitialState)
  const actions = useMemo(() => createUIActions(dispatch), [dispatch])

  // Locales auxiliares
  const [notes, setNotes] = useState('')
  const [copiedJSON, setCopiedJSON] = useState<null | 'ok' | 'err'>(null)
  const [copiedComment, setCopiedComment] = useState<null | 'ok' | 'err'>(null)
  const [copiedKey, setCopiedKey] = useState<null | 'ok' | 'err'>(null)
  const [showExecution, setShowExecution] = useState(false)

  // ---- Derivadas con selectores
  const selectedCriterion = useMemo(
    () => selectSelectedCriterion(CRITERIA, state.selectedCriterionId),
    [state.selectedCriterionId]
  )
  const acceptedCriterion = useMemo(
    () => selectAcceptedCriterion(CRITERIA, state.acceptedCriterionId),
    [state.acceptedCriterionId]
  )

  const selectedEval = useMemo(
    () => selectSelectedEval(selectedCriterion, state.critAnswers, state.critJustifications),
    [selectedCriterion, state.critAnswers, state.critJustifications]
  )

  const selectedReadyToAccept = useMemo(
    () =>
      selectSelectedReadyToAccept(
        selectedCriterion,
        selectedEval.status,
        state.critAnswers,
        state.critJustifications
      ),
    [selectedCriterion, selectedEval.status, state.critAnswers, state.critJustifications]
  )

  const { answeredCount: critAnsweredCount, pct: critProgressPct } = useMemo(
    () => selectCriterionProgress(selectedCriterion, state.critAnswers),
    [selectedCriterion, state.critAnswers]
  )

  const frameworkEval = useMemo(
    () => selectFrameworkEval(FRAMEWORK, LEVELS, state.frameworkAnswers),
    [state.frameworkAnswers]
  )
  const { score, level, allAnswered } = frameworkEval

  const levelColor = useMemo(() => selectLevelColor(level, LEVELS), [level])
  const answeredCount = useMemo(
    () => selectAnsweredCount(state.frameworkAnswers),
    [state.frameworkAnswers]
  )
  const progressPct = useMemo(
    () => selectFrameworkProgress(answeredCount, FRAMEWORK.questions.length),
    [answeredCount]
  )

  const showFramework = useMemo(() => selectShowFramework(state), [state.ticketConfirmed, state.criterionPass])
  const frameworkReady = useMemo(() => selectFrameworkReady(state, allAnswered), [state.ticketConfirmed, state.criterionPass, allAnswered])
  const canShowExecution = useMemo(() => selectCanShowExecution(state, frameworkReady), [state.ticketConfirmed, state.criterionPass, frameworkReady])

  useEffect(() => {
    if (canShowExecution) setShowExecution(true)
  }, [canShowExecution])

  const decisionReady = useMemo(
    () => selectDecisionReady(state, frameworkReady),
    [state.ticketConfirmed, state.criterionPass, frameworkReady]
  )

  const showActions = useMemo(
    () => selectShowActions(state, selectedCriterion, decisionReady),
    [state.ticketConfirmed, selectedCriterion, decisionReady]
  )

  const showBack = useMemo(
    () => selectShowBack(state, selectedCriterion, showExecution),
    [state.ticketConfirmed, selectedCriterion, state.criterionPass, showExecution]
  )

  const jiraUrl = useMemo(() => selectJiraUrl(JIRA_BASE, state.jiraKey), [state.jiraKey])

  // ---- Helpers
  async function copyTicketKey() {
    const ok = await writeClipboard(state.jiraKey)
    setCopiedKey(ok ? 'ok' : 'err')
    setTimeout(() => setCopiedKey(null), 1200)
  }

  function resetAllAndLocal() {
    actions.changeTicket() // limpia criterios+framework y vuelve a edición (mantiene KEY)
    setNotes('')
    setShowExecution(false)
  }

  function handleBack() {
    if (selectedCriterion) {
      actions.selectCriterionId(null)
      return
    }
    if (showExecution) {
      if (state.criterionPass === 'fail') {
        setShowExecution(false)
        return
      }
      if (state.criterionPass === 'pass') {
        actions.resetCriteria()
        return
      }
    }
    if (state.ticketConfirmed && state.criterionPass === 'fail') {
      actions.resetCriteria()
      return
    }
  }

  async function copyPayload() {
    const mode: 'criterion' | 'framework' | 'pending' =
      state.criterionPass === 'pass' ? 'criterion' : state.criterionPass === 'fail' ? 'framework' : 'pending'

    const payload = buildPayload({
      ticket: state.jiraKey,
      mode,
      criterion:
        mode === 'criterion' && acceptedCriterion
          ? {
              def: acceptedCriterion,
              answers: state.critAnswers,
              justifications: state.critJustifications,
            }
          : undefined,
      framework:
        mode === 'framework'
          ? {
              def: FRAMEWORK,
              answers: state.frameworkAnswers,
              score,
              level,
              allAnswered,
            }
          : undefined,
      notes,
    })

    const ok = await writeClipboard(JSON.stringify(payload, null, 2))
    setCopiedJSON(ok ? 'ok' : 'err')
    setTimeout(() => setCopiedJSON(null), 1500)
  }

  async function copyJiraComment() {
    let text = ''
    if (state.criterionPass === 'pass' && (state.acceptedSnapshot || acceptedCriterion)) {
      const def = state.acceptedSnapshot?.def ?? acceptedCriterion!
      const ans = state.acceptedSnapshot?.answers ?? state.critAnswers
      const jus = state.acceptedSnapshot?.justifications ?? state.critJustifications
      text = buildCommentForCriterion(def, ans, jus, notes)
    } else if (state.criterionReviewRequested && state.reviewSnapshot) {
      text = buildReviewCommentForCriterion(
        state.reviewSnapshot.def,
        state.reviewSnapshot.answers,
        state.reviewSnapshot.justifications,
        notes
      )
    } else if (state.criterionPass === 'fail') {
      text = buildCommentForFramework(FRAMEWORK, state.frameworkAnswers, score, level, allAnswered, notes)
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
            {state.ticketConfirmed
              ? 'Seleccioná un criterio (si aplica) o continuá con el framework de riesgo.'
              : 'Confirmá el ticket. Luego, opcionalmente elegí un criterio (si aplica) o pasá directo al framework de riesgo.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Ticket */}
          <TicketForm
            jiraKey={state.jiraKey}
            isJiraKeyValid={Boolean(state.jiraKey) && Boolean(jiraUrl)} // usa selector de URL para validar
            ticketConfirmed={state.ticketConfirmed}
            jiraUrl={jiraUrl}
            onChangeKey={(v) => actions.setTicketKey(v.toUpperCase())}
            onConfirm={actions.confirmTicket}
            onChangeTicket={resetAllAndLocal}
            copyTicketKey={copyTicketKey}
            copiedKey={copiedKey}
          />

          {/* Criterios (opcional) mientras no se eligió flujo */}
          {state.ticketConfirmed && state.criterionPass === 'pending' && !state.criterionReviewRequested && (
            <div className="space-y-4">
              <CriteriaSection
                CRITERIA={CRITERIA}
                selectedCriterion={selectedCriterion}
                critAnswers={state.critAnswers}
                critJustifications={state.critJustifications}
                selectedEvalLabel={displayLabel(selectedEval.label as DecisionLabel)}
                statusBadgeClass={cn('shrink-0', badgeColor(selectedEval.label as DecisionLabel))}
                selectedReadyToAccept={selectedReadyToAccept}
                onGoToFramework={actions.goToFramework}
                onSelectCriterionId={actions.selectCriterionId}
                onSetAnswer={actions.setCritAnswer}
                onSetJustification={actions.setCritJustification}
                onAcceptByCriterion={actions.acceptByCriterion}
                onRequestReview={actions.requestReview}
                onDiscardToFramework={actions.goToFramework}
              />
            </div>
          )}

          <CriteriaStatusCards
            showAccepted={state.ticketConfirmed && state.criterionPass === 'pass'}
            showReviewRequested={
              state.ticketConfirmed && state.criterionPass === 'pending' && state.criterionReviewRequested
            }
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
              answers={state.frameworkAnswers}
              onSetAnswer={(qid, v) => actions.setFrameworkAnswer(qid, v as QA)}
            />
          )}

          {/* Sticky de criterio (en vivo) */}
          {state.ticketConfirmed && state.criterionPass === 'pending' && selectedCriterion && (
            <div className="fixed bottom-6 right-6 z-50">
              <Card className="shadow-xl border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Badge className={cn('text-white', badgeColor(selectedEval.label as DecisionLabel))}>
                      {displayLabel(selectedEval.label as DecisionLabel)}
                    </Badge>
                    <span className="font-semibold text-sm truncate max-w-[220px]">
                      {selectedCriterion.title}
                    </span>
                    {(selectedEval.label as string) === 'REVISAR' && (
                      <span className="ml-auto text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Requiere revisión
                      </span>
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
          {state.ticketConfirmed && state.criterionPass === 'fail' && (
            <div className="fixed bottom-6 right-6 z-50">
              <Card className="shadow-xl border">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Badge className={cn('text-white', levelColor)}>{level}</Badge>
                    <span className="font-semibold text-lg">{score} pts</span>
                    <span className="text-xs text-muted-foreground">
                      {frameworkReady ? 'Riesgo FINAL' : 'Riesgo temporal'}
                    </span>
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
                <Button variant="secondary" onClick={resetAllAndLocal}>
                  Reiniciar
                </Button>
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
