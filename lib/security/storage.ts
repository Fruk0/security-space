'use client'

import { useEffect } from 'react'
import type { QA } from '@/lib/security/domain'

const NS = 'sro:fw'
const keyFor = (jiraKey: string) => `${NS}:${jiraKey}`

/**
 * Hidrata respuestas del framework desde localStorage (si existen)
 * y guarda cambios cada vez que cambian.
 */
export function useFrameworkStorage(
  jiraKey: string,
  answers: Record<string, QA>,
  setFrameworkAnswer: (qid: string, value: QA) => void
) {
  // Hidratar al cambiar de ticket (solo si aún no hay respuestas)
  useEffect(() => {
    if (!jiraKey) return
    try {
      const raw = localStorage.getItem(keyFor(jiraKey))
      if (!raw) return
      const data = JSON.parse(raw) as Record<string, QA> | null
      if (!data) return
      if (Object.keys(answers).length > 0) return // ya hay respuestas cargadas
      for (const [qid, value] of Object.entries(data)) {
        setFrameworkAnswer(qid, value as QA)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraKey])

  // Guardar en cada cambio
  useEffect(() => {
    if (!jiraKey) return
    try {
      localStorage.setItem(keyFor(jiraKey), JSON.stringify(answers))
    } catch {
      // ignore
    }
  }, [jiraKey, answers])
}

export function clearFrameworkStorage(jiraKey?: string) {
  try {
    if (jiraKey) localStorage.removeItem(keyFor(jiraKey))
  } catch {
    // ignore
  }
}
