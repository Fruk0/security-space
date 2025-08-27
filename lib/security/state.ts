// lib/security/state.ts
import type { Dispatch } from 'react'
import type { QA } from '@/lib/security/domain'

// ---------- Tipos de dominio mínimo que usa el estado ----------
export type CriterionPass = 'pending' | 'pass' | 'fail'

export type CriterionQuestion = {
  id: string
  text?: string | null
  requiresJustificationWhen?: QA[]
}

export type CriterionDef = {
  id: string
  title: string
  description?: string | null
  questions: CriterionQuestion[]
}

export type Snapshot = {
  def: CriterionDef
  answers: Record<string, QA>
  justifications: Record<string, string>
}

// ---------- Estado UI ----------
export type UIState = {
  // Ticket
  jiraKey: string
  ticketConfirmed: boolean

  // Criterios
  criterionPass: CriterionPass
  criterionReviewRequested: boolean
  selectedCriterionId: string | null
  acceptedCriterionId: string | null
  critAnswers: Record<string, QA>
  critJustifications: Record<string, string>
  acceptedSnapshot: Snapshot | null
  reviewSnapshot: Snapshot | null

  // Framework
  frameworkAnswers: Record<string, QA>
}

// ---------- Acciones ----------
export type UIAction =
  | { type: 'ticket/setKey'; key: string }
  | { type: 'ticket/confirm' }
  | { type: 'ticket/change' } // vuelve a edición y limpia criterios+framework (conserva la KEY)

  | { type: 'criteria/select'; id: string | null }
  | { type: 'criteria/goToFramework' }
  | { type: 'criteria/setAnswer'; qid: string; value: QA }
  | { type: 'criteria/setJustification'; qid: string; value: string }
  | { type: 'criteria/accept'; snap: Snapshot }
  | { type: 'criteria/requestReview'; snap: Snapshot }
  | { type: 'criteria/reset' }

  | { type: 'framework/setAnswer'; qid: string; value: QA }

  | { type: 'reset/all' }

// ---------- Estado inicial ----------
export function createInitialState(): UIState {
  return {
    jiraKey: '',
    ticketConfirmed: false,

    criterionPass: 'pending',
    criterionReviewRequested: false,
    selectedCriterionId: null,
    acceptedCriterionId: null,
    critAnswers: {},
    critJustifications: {},
    acceptedSnapshot: null,
    reviewSnapshot: null,

    frameworkAnswers: {},
  }
}

// ---------- Reducer ----------
export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    // Ticket
    case 'ticket/setKey':
      return { ...state, jiraKey: action.key }
    case 'ticket/confirm':
      return { ...state, ticketConfirmed: true }
    case 'ticket/change':
      return {
        ...state,
        ticketConfirmed: false,
        criterionPass: 'pending',
        criterionReviewRequested: false,
        selectedCriterionId: null,
        acceptedCriterionId: null,
        critAnswers: {},
        critJustifications: {},
        acceptedSnapshot: null,
        reviewSnapshot: null,
        frameworkAnswers: {},
      }

    // Criterios
    case 'criteria/select':
      return { ...state, selectedCriterionId: action.id }
    case 'criteria/goToFramework':
      return {
        ...state,
        criterionPass: 'fail',
        selectedCriterionId: null,
        acceptedCriterionId: null,
        criterionReviewRequested: false,
        reviewSnapshot: null,
      }
    case 'criteria/setAnswer':
      return {
        ...state,
        critAnswers: { ...state.critAnswers, [action.qid]: action.value },
      }
    case 'criteria/setJustification':
      return {
        ...state,
        critJustifications: { ...state.critJustifications, [action.qid]: action.value },
      }
    case 'criteria/accept':
      return {
        ...state,
        acceptedSnapshot: action.snap,
        acceptedCriterionId: action.snap.def.id,
        criterionPass: 'pass',
        selectedCriterionId: null,
        criterionReviewRequested: false,
        reviewSnapshot: null,
      }
    case 'criteria/requestReview':
      return {
        ...state,
        criterionReviewRequested: true,
        reviewSnapshot: action.snap,
        selectedCriterionId: null,
      }
    case 'criteria/reset':
      return {
        ...state,
        criterionPass: 'pending',
        criterionReviewRequested: false,
        selectedCriterionId: null,
        acceptedCriterionId: null,
        critAnswers: {},
        critJustifications: {},
        acceptedSnapshot: null,
        reviewSnapshot: null,
      }

    // Framework
    case 'framework/setAnswer':
      return {
        ...state,
        frameworkAnswers: { ...state.frameworkAnswers, [action.qid]: action.value },
      }

    // Reset total
    case 'reset/all':
      return createInitialState()

    default:
      return state
  }
}

// ---------- Action creators (typed, listos para usar en el page) ----------
export function createUIActions(dispatch: Dispatch<UIAction>) {
  return {
    // Ticket
    setTicketKey: (key: string) => dispatch({ type: 'ticket/setKey', key }),
    confirmTicket: () => dispatch({ type: 'ticket/confirm' }),
    changeTicket: () => dispatch({ type: 'ticket/change' }),

    // Criterios
    selectCriterionId: (id: string | null) => dispatch({ type: 'criteria/select', id }),
    goToFramework: () => dispatch({ type: 'criteria/goToFramework' }),
    setCritAnswer: (qid: string, value: QA) =>
      dispatch({ type: 'criteria/setAnswer', qid, value }),
    setCritJustification: (qid: string, value: string) =>
      dispatch({ type: 'criteria/setJustification', qid, value }),
    acceptByCriterion: (snap: Snapshot) => dispatch({ type: 'criteria/accept', snap }),
    requestReview: (snap: Snapshot) => dispatch({ type: 'criteria/requestReview', snap }),
    resetCriteria: () => dispatch({ type: 'criteria/reset' }),

    // Framework
    setFrameworkAnswer: (qid: string, value: QA) =>
      dispatch({ type: 'framework/setAnswer', qid, value }),

    // Reset total
    resetAll: () => dispatch({ type: 'reset/all' }),
  }
}
