import { describe, it, expect } from 'vitest'
import { JIRA_KEY_RE, isValidJiraKey } from '@/lib/security/validators'

describe('JIRA key validation', () => {
  it('acepta FORMATO ABC-123', () => {
    expect(isValidJiraKey('CS-1')).toBe(true)
    expect(isValidJiraKey('PAY-456')).toBe(true)
  })
  it('rechaza formatos inválidos', () => {
    expect(isValidJiraKey('cs-1')).toBe(false)
    expect(isValidJiraKey('ABCDEF-1')).toBe(false) // 1..4 letras
    expect(isValidJiraKey('ABC-')).toBe(false)
  })
})

