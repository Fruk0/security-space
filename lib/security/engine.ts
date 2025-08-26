import type {
  CriterionDef, CriterionAnswers, DecisionStatus, DecisionLabel, QA,
  FrameworkDef, FrameworkAnswers, RiskLevelBand, RiskLevelKey
} from './domain'

/* ===========================
 * Criterios (igual que antes)
 * =========================== */
export function evalCriterion(def: CriterionDef, answers: CriterionAnswers): {
  status: DecisionStatus; label: DecisionLabel; allYes: boolean;
} {
  const qs = def.questions
  const answered = qs.filter(q => answers[q.id] !== undefined).length
  if (answered === 0) return { status: 'pending', label: 'PENDIENTE', allYes: false }

  const allYes = qs.every(q => answers[q.id] === 'yes')
  const hasUnknown = qs.some(q => answers[q.id] === 'unknown')
  const incomplete = answered < qs.length

  const status: DecisionStatus = allYes ? 'pass' : (hasUnknown || incomplete) ? 'fail' : 'fail'
  const label: DecisionLabel = allYes ? 'PASA' : (hasUnknown || incomplete) ? 'REVISAR' : 'NO PASA' // si renombraste a "NO APLICA", cambia acá

  return { status, label, allYes }
}

/* =======================================================
 * Riesgo: “No sé” cuenta como riesgo (worst-case) con factor
 * ======================================================= */

// [PISTA] Ajustá si querés que "No sé" pese un poco menos (ej: 0.85).
export const UNKNOWN_WEIGHT_FACTOR = 1.0

// [PISTA] ¿Aporta riesgo? → “unknown” SIEMPRE cuenta (para rationale/comentarios)
export function shouldCount(riskWhen: any, a: QA | undefined): boolean {
  if (!a || !riskWhen) return false
  if (a === 'unknown') return true // peor caso

  if (Array.isArray(riskWhen)) return riskWhen.includes(a)

  if (riskWhen === 'yes') return a === 'yes'
  if (riskWhen === 'no') return a === 'no'
  if (riskWhen === 'unknown') return a === 'unknown'
  if (riskWhen === 'no_or_unknown') return a === 'no' || a === 'unknown'
  if (riskWhen === 'yes_or_unknown') return a === 'yes' || a === 'unknown'
  return false
}

// [PISTA] Factor de puntaje según respuesta (1 = riesgo total; unknown = factor configurable)
export function answerRiskFactor(
  answer: QA | undefined,
  riskWhen: any,
  unknownFactor: number = UNKNOWN_WEIGHT_FACTOR
): number {
  if (!answer || !riskWhen) return 0

  if (Array.isArray(riskWhen)) {
    if (riskWhen.includes(answer)) return 1
  } else {
    if (riskWhen === 'yes' && answer === 'yes') return 1
    if (riskWhen === 'no' && answer === 'no') return 1
    if (riskWhen === 'unknown' && answer === 'unknown') return 1
    if (riskWhen === 'no_or_unknown' && (answer === 'no' || answer === 'unknown')) return 1
    if (riskWhen === 'yes_or_unknown' && (answer === 'yes' || answer === 'unknown')) return 1
  }

  if (answer === 'unknown') return unknownFactor
  return 0
}

/* ==========================================
 * Niveles de riesgo: bandas sin "huecos"
 * ========================================== */

// [PISTA] Usa intervalos semiabiertos [min, next.min) para evitar huecos/decimales raros.
// Ignoramos 'max' y usamos el 'min' de la siguiente banda como límite superior.
// La última banda cubre hasta +∞.
function resolveRiskLevel(score: number, levels: RiskLevelBand[]): RiskLevelKey {
  if (!levels || levels.length === 0) return 'Low' as RiskLevelKey

  const sorted = [...levels].sort((a, b) => a.min - b.min)

  // Validación básica (opcional)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min < sorted[i - 1].min) {
      console.warn('[risk-levels] Bandas fuera de orden por min:', sorted)
      break
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i]
    const next = sorted[i + 1]
    const upperExclusive = next ? next.min : Number.POSITIVE_INFINITY
    if (score >= curr.min && score < upperExclusive) {
      return curr.key as RiskLevelKey
    }
  }

  // Fallback: última banda
  return sorted[sorted.length - 1].key as RiskLevelKey
}

/* ===========================
 * Framework (usa factor + bandas robustas)
 * =========================== */
export function evalFramework(def: FrameworkDef, levels: RiskLevelBand[], answers: FrameworkAnswers) {
  // “No sé” suma riesgo (factor configurable)
  const score = def.questions.reduce((acc, q) => {
    const factor = answerRiskFactor(answers[q.id], q.riskWhen, UNKNOWN_WEIGHT_FACTOR)
    return acc + (q.weight * factor)
  }, 0)

  const level = resolveRiskLevel(score, levels)
  const allAnswered = Object.keys(answers).length === def.questions.length

  return { score, level, allAnswered }
}
