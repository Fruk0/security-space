// lib/security/selectors.ts
import type { UIState } from './state'
import type {
  QA,
  CriterionDef,
  CriterionAnswers,
  DecisionStatus,
  DecisionLabel,
} from '@/lib/security/domain'
import { evalCriterion, evalFramework } from '@/lib/security/engine'
import { isValidJiraKey } from '@/lib/security/validators'

// Tipos mínimos auxiliares
export type Level = { key: string; color: string }
export type FrameworkDef = { questions: Array<{ id: string; text: string; riskType: string; weight: number }> }

// ----------- Criterios -----------
export function selectSelectedCriterion(
  criteria: CriterionDef[],
  id: string | null
): CriterionDef | null {
  return id ? criteria.find((c) => c.id === id) ?? null : null
}

export function selectAcceptedCriterion(
  criteria: CriterionDef[],
  id: string | null
): CriterionDef | null {
  return id ? criteria.find((c) => c.id === id) ?? null : null
}

export function selectSelectedEval(
  selectedCriterion: CriterionDef | null,
  critAnswers: Record<string, QA>,
  critJustifications: Record<string, string>
) {
  if (!selectedCriterion)
    return { status: 'pending' as DecisionStatus, label: 'PENDIENTE' as DecisionLabel, allYes: false }
  // Si tu engine necesita justifications, agrégalas al segundo parámetro según tu firma real
  return evalCriterion(selectedCriterion, critAnswers as CriterionAnswers)
}

export function selectSelectedReadyToAccept(
  selectedCriterion: CriterionDef | null,
  selectedEvalStatus: DecisionStatus,
  critAnswers: Record<string, QA>,
  critJustifications: Record<string, string>
) {
  if (!selectedCriterion || selectedEvalStatus !== 'pass') return false
  return selectedCriterion.questions.every((q) => {
    if (critAnswers[q.id] !== 'yes') return true
    if (!q.requiresJustificationWhen?.includes('yes')) return true
    return !!critJustifications[q.id]?.trim()
  })
}

export function selectCriterionProgress(
  selectedCriterion: CriterionDef | null,
  critAnswers: Record<string, QA>
) {
  if (!selectedCriterion) return { answeredCount: 0, pct: 0 }
  const answeredCount = selectedCriterion.questions.reduce(
    (acc, q) => acc + (critAnswers[q.id] ? 1 : 0),
    0
  )
  const pct = Math.round((answeredCount / selectedCriterion.questions.length) * 100)
  return { answeredCount, pct }
}

// ----------- Framework -----------
export function selectFrameworkEval(
  framework: FrameworkDef,
  levels: Level[],
  answers: Record<string, QA>
) {
  // Devuelve { score, level, allAnswered } (según tu engine)
  return evalFramework(framework, levels, answers)
}

export function selectLevelColor(level: string, levels: Level[]) {
  return levels.find((l) => l.key === level)?.color ?? 'bg-emerald-500'
}

export function selectAnsweredCount(answers: Record<string, QA>) {
  return Object.keys(answers).length
}

export function selectFrameworkProgress(totalAnswered: number, totalQuestions: number) {
  return Math.round((totalAnswered / totalQuestions) * 100)
}

// ----------- UI flow -----------
export function selectShowFramework(state: UIState) {
  return state.ticketConfirmed && state.criterionPass === 'fail'
}

export function selectFrameworkReady(state: UIState, allAnswered: boolean) {
  return state.ticketConfirmed && state.criterionPass === 'fail' && allAnswered
}

export function selectCanShowExecution(state: UIState, frameworkReady: boolean) {
  return state.ticketConfirmed && (state.criterionPass === 'pass' || (state.criterionPass === 'fail' && frameworkReady))
}

export function selectDecisionReady(state: UIState, frameworkReady: boolean) {
  if (!state.ticketConfirmed) return false
  if (state.criterionPass === 'pass') return true
  if (state.criterionPass === 'fail') return frameworkReady
  return false
}

export function selectShowActions(
  state: UIState,
  selectedCriterion: CriterionDef | null,
  decisionReady: boolean
) {
  if (!state.ticketConfirmed) return false
  if (selectedCriterion) return false
  return decisionReady
}

export function selectShowBack(
  state: UIState,
  selectedCriterion: CriterionDef | null,
  showExecution: boolean
) {
  return state.ticketConfirmed && (Boolean(selectedCriterion) || state.criterionPass === 'fail' || showExecution)
}

// ----------- Jira URL -----------
export function selectJiraUrl(base: string | undefined, key: string) {
  if (!base || !key || !isValidJiraKey(key)) return null
  return `${base.replace(/\/+$/, '')}/browse/${key}`
}
