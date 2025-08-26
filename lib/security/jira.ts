import type {
  CriterionDef, CriterionAnswers, FrameworkDef, FrameworkAnswers
} from './domain';
import { shouldCount } from './engine';

export function buildPayload(opts: {
  ticket: string;
  mode: 'criterion' | 'framework' | 'pending';
  criterion?: { def: CriterionDef; answers: CriterionAnswers; justifications: Record<string, string> };
  framework?: { def: FrameworkDef; answers: FrameworkAnswers; score: number; level: string; allAnswered: boolean };
  notes?: string;
}) {
  const { ticket, mode, criterion, framework, notes } = opts;

  const rationale = framework
    ? framework.def.questions
        .filter(q => shouldCount(q.riskWhen, framework.answers[q.id]))
        .map(q => ({ id: q.id, text: q.text, weight: q.weight, answer: framework.answers[q.id] }))
    : [];

  return {
    ticket: ticket.trim(),
    decision: {
      mode,
      byCriterion: mode === 'criterion' && criterion ? {
        used: criterion.def.id,
        title: criterion.def.title,
        answers: criterion.answers,
        justifications: criterion.justifications
      } : null,
      byFramework: mode === 'framework' && framework ? {
        score: framework.score,
        level: framework.level,
        answers: framework.answers,
        allAnswered: framework.allAnswered
      } : null
    },
    notes,
    rationale,
    generatedAt: new Date().toISOString()
  };
}

export function buildCommentForCriterion(
  def: CriterionDef,
  answers: CriterionAnswers,
  just: Record<string, string>,
  notes?: string
) {
  const linesArr = def.questions
    .filter(q => answers[q.id] === 'yes')
    .map(q => {
      const j = (just[q.id] ?? '').trim()
      const justLine = j ? `  ${j}` : '  —'
      return `- ${q.text}\n${justLine}`
    })

  const lines = linesArr.join('\n')
  const safeBlock = lines.trim().length ? lines : '—' // <- SIEMPRE muestra “—” si quedó vacío

  return [
    `Solicito aplicar el **criterio de ciberseguridad**: ${def.title}.`,
    `Respuestas y justificaciones:`,
    safeBlock,
    notes?.trim() ? `Notas: ${notes.trim()}` : ''
  ].filter(Boolean).join('\n\n')
}


export function buildCommentForFramework(def: FrameworkDef, answers: FrameworkAnswers, score: number, level: string, allAnswered: boolean, notes?: string) {
  const lines = def.questions
    .filter(q => shouldCount(q.riskWhen, answers[q.id]))
    .map(q => `- ${q.text} (+${q.weight})\n  Respuesta: ${answers[q.id]}`)
    .join('\n');
  return [
    `Solicito registrar el **Security Risk** calculado.`,
    `Nivel: **${level}** (${score} pts).`,
    allAnswered ? 'Todas las preguntas del framework fueron respondidas.' : 'Aún hay preguntas sin responder.',
    `Respuestas que aportan riesgo:`,
    lines || '—',
    notes ? `Notas: ${notes}` : ''
  ].filter(Boolean).join('\n\n');
}
// --- NUEVO: comentario para "Revisión solicitada" de un criterio --- //
import type { QA } from './domain' // [PISTA] si ya importás QA en otro lado, omití esta línea

function toAnswerLabel(ans?: QA) {
  if (ans === 'yes') return 'Aplica'
  if (ans === 'no') return 'No aplica'
  if (ans === 'unknown') return 'Duda'
  return '—'
}

/**
 * buildReviewCommentForCriterion
 * Arma el comentario para Jira cuando se solicita revisión de un criterio.
 * - Lista TODAS las afirmaciones del criterio (respondidas o no)
 * - Incluye Respuesta y, si existe, Justificación
 */
export function buildReviewCommentForCriterion(
  def: CriterionDef,
  answers: CriterionAnswers,
  just: Record<string, string>,
  notes?: string
) {
  const header = 'Se requiere **revisión del criterio de ciberseguridad**. **No se acepta el criterio** hasta resolver la revisión.\n\n'
  const titulo = `**Criterio:** ${def.title}\n`
  const cuerpo = def.questions.map(q => {
    const ansLabel = toAnswerLabel(answers[q.id])
    const j = (just[q.id] ?? '').trim()
    const lines = [
      `- ${q.text}`,
      `  - Respuesta: **${ansLabel}**`,
      j ? `  - Justificación: ${j}` : null
    ].filter(Boolean)
    return lines.join('\n')
  }).join('\n')

  const notas = notes?.trim() ? `\n\n**Notas adicionales:**\n${notes.trim()}` : ''
  return `${header}${titulo}\n${cuerpo}${notas}`
}
