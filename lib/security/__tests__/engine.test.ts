import { describe, it, expect } from 'vitest'
import { evalCriterion, shouldCount, answerRiskFactor, evalFramework, UNKNOWN_WEIGHT_FACTOR } from '@/lib/security/engine'
import type { CriterionDef, FrameworkDef, RiskLevelBand, QA } from '@/lib/security/domain'

describe('evalCriterion', () => {
  const def: CriterionDef = {
    id: 'C1',
    title: 'Dummy',
    passRule: { type: 'allYes' },
    questions: [{ id: 'q1', text: 'A' }, { id: 'q2', text: 'B' }]
  }

  it('pending sin respuestas', () => {
    const r = evalCriterion(def, {})
    expect(r.status).toBe('pending')
    expect(r.label).toBe('PENDIENTE') // :contentReference[oaicite:3]{index=3}
  })

  it('pass cuando todas son yes', () => {
    const r = evalCriterion(def, { q1: 'yes', q2: 'yes' })
    expect(r.status).toBe('pass')
    expect(['PASA', 'NO PASA', 'REVISAR']).toContain(r.label)
    expect(r.label).toBe('PASA') // :contentReference[oaicite:4]{index=4}
  })

  it('fail/REVISAR si hay unknown o incompleto', () => {
    const r1 = evalCriterion(def, { q1: 'unknown' })
    const r2 = evalCriterion(def, { q1: 'yes' }) // incompleto
    expect(r1.label).toBe('REVISAR')
    expect(r2.label).toBe('REVISAR') // :contentReference[oaicite:5]{index=5}
  })

  it('fail/NO PASA si todas respondidas y ninguna pasa', () => {
    const r = evalCriterion(def, { q1: 'no', q2: 'no' })
    expect(r.label).toBe('NO PASA') // :contentReference[oaicite:6]{index=6}
  })
})

describe('shouldCount & answerRiskFactor', () => {
  it('unknown siempre cuenta para rationale y factor configurable', () => {
    expect(shouldCount('unknown', 'unknown')).toBe(true) // :contentReference[oaicite:7]{index=7}
    expect(answerRiskFactor('unknown', 'yes_or_unknown')).toBe(1) // :contentReference[oaicite:8]{index=8}
    expect(answerRiskFactor('unknown', 'no')).toBe(UNKNOWN_WEIGHT_FACTOR) // peor caso, factor para unknown
  })

  it('matrices yes/no/_or_unknown correctas', () => {
    expect(shouldCount('yes_or_unknown', 'yes')).toBe(true)
    expect(shouldCount('no_or_unknown', 'no')).toBe(true) // :contentReference[oaicite:9]{index=9}
    expect(answerRiskFactor('no', 'yes')).toBe(0) // no aporta
  })
})

describe('evalFramework + bandas [min, next.min)', () => {
  const levels: RiskLevelBand[] = [
    { key: 'Low', min: 0, max: 10, color: 'emerald' },
    { key: 'Medium', min: 10, max: 20, color: 'amber' },
    { key: 'High', min: 20, max: 999, color: 'rose' },
  ]

  const def: FrameworkDef = {
    questions: [
      { id: 'q1', text: 'R1', weight: 10, riskType: 'auth', riskWhen: 'yes_or_unknown' },
      { id: 'q2', text: 'R2', weight: 10, riskType: 'fraud', riskWhen: 'no' },
    ]
  }

  it('score suma por factor & mapea banda robusta', () => {
    const answers = { q1: 'yes' as QA, q2: 'no' as QA }
    const r = evalFramework(def, levels, answers)
    // q1 yes (yes_or_unknown) -> 10, q2 no (no) -> 10 => score 20 -> High
    expect(r.score).toBe(20) // :contentReference[oaicite:10]{index=10}
    expect(r.level).toBe('High') // :contentReference[oaicite:11]{index=11}
    expect(r.allAnswered).toBe(true) // :contentReference[oaicite:12]{index=12}
  })

  it('unknown pondera y puede cambiar la banda', () => {
    const answers = { q1: 'unknown' as QA, q2: 'yes' as QA } // q1 aporta por unknown, q2 no
    const r = evalFramework(def, levels, answers)
    expect(r.score).toBe(10) // unknown factor=1.0 por default
    expect(['Low','Medium','High']).toContain(r.level)
  })
})

