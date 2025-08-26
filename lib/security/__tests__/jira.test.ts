import { describe, it, expect } from 'vitest'
import { buildPayload, buildReviewCommentForCriterion } from '@/lib/security/jira'
import type { CriterionDef, FrameworkDef, RiskLevelBand } from '@/lib/security/domain'

describe('buildPayload', () => {
  const def: FrameworkDef = {
    questions: [
      { id: 'q1', text: 'Auth',  weight: 5, riskType: 'auth',  riskWhen: 'yes_or_unknown' },
      { id: 'q2', text: 'Fraud', weight: 5, riskType: 'fraud', riskWhen: 'no' },
    ]
  }

  const levels: RiskLevelBand[] = [
    { key: 'Low',  min: 0,  max: 10, color: 'emerald' },
    { key: 'High', min: 10, max: 99, color: 'rose' },
  ]

  it('incluye rationale solo de preguntas que cuentan riesgo', () => {
    // q1: yes -> cuenta (yes_or_unknown); q2: yes -> NO cuenta (riskWhen=no)
    const framework = { def, answers: { q1: 'yes', q2: 'yes' }, score: 5, level: 'Low', allAnswered: false }
    const p = buildPayload({ ticket: 'CS-123', mode: 'framework', framework })
    expect(p.ticket).toBe('CS-123')
    expect(Array.isArray(p.rationale)).toBe(true)
    expect(p.rationale).toHaveLength(1)
    expect(p.rationale[0].id).toBe('q1')
  })
})

describe('buildReviewCommentForCriterion', () => {
  const def: CriterionDef = {
    id: 'C1',
    title: 'Criterio demo',
    passRule: { type: 'allYes' },
    questions: [
      { id: 'a', text: 'Afirmación A' },
      { id: 'b', text: 'Afirmación B' },
    ],
  }

  it('formatea lista completa con respuestas y justificaciones', () => {
    const text = buildReviewCommentForCriterion(
      def,
      { a: 'yes', b: 'unknown' },   // a -> Aplica, b -> Duda
      { a: 'ok' },                  // justificación solo para a
      'nota extra'
    )

    // Encabezados y contenido
    expect(text).toContain('Criterio demo')
    expect(text).toContain('Afirmación A')
    expect(text).toContain('Afirmación B')

    // Labels de respuesta según el producto (Aplica / No aplica / Duda)
    expect(text).toContain('Respuesta: **Aplica**') // para a
    expect(text).toContain('Respuesta: **Duda**')   // para b

    // Justificación y notas
    expect(text).toContain('Justificación: ok')
    expect(text).toContain('Notas adicionales:')
    expect(text).toContain('nota extra')

    // Mensaje de cabecera de revisión (no falla, solo informa)
    expect(text).toMatch(/revisión del criterio/i)
  })
})
