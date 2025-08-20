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

export function buildCommentForCriterion(def: CriterionDef, answers: CriterionAnswers, just: Record<string, string>, notes?: string) {
  const lines = def.questions
    .filter(q => answers[q.id] === 'yes')
    .map(q => `- ${q.text}\n  ${just[q.id] || '—'}`)
    .join('\n');
  return [
    `Solicito aplicar el **criterio de ciberseguridad**: ${def.title}.`,
    `Respuestas y justificaciones:`,
    lines || '—',
    notes ? `Notas: ${notes}` : ''
  ].filter(Boolean).join('\n\n');
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
