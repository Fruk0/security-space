'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export const URL_PARAM_TICKET = 't'
export const URL_PARAM_CRIT = 'crit'

type Options = {
  jiraKey: string
  selectedCriterionId: string | null
  setTicketKey: (key: string) => void
  selectCriterionId: (id: string | null) => void
  validateCriterionId?: (id: string) => boolean
}

/**
 * Sincroniza:
 *  - Lectura inicial desde URL (?t=KEY&crit=CRIT_ID)
 *  - Escritura cuando cambian jiraKey / selectedCriterionId
 */
export function useUrlSync({
  jiraKey,
  selectedCriterionId,
  setTicketKey,
  selectCriterionId,
  validateCriterionId,
}: Options) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const didHydrateRef = useRef(false)

  // --- Lectura inicial desde la URL
  useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true

    const t = searchParams.get(URL_PARAM_TICKET)
    const crit = searchParams.get(URL_PARAM_CRIT)

    if (t) setTicketKey(t.toUpperCase())

    if (crit) {
      if (!validateCriterionId || validateCriterionId(crit)) {
        selectCriterionId(crit)
      } else {
        // si no es válido, lo limpiaremos en la próxima escritura
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Escritura cuando cambian los valores
  useEffect(() => {
    const current = new URLSearchParams(searchParams.toString())
    const prevStr = current.toString()

    // t
    if (jiraKey) current.set(URL_PARAM_TICKET, jiraKey)
    else current.delete(URL_PARAM_TICKET)

    // crit
    if (selectedCriterionId) current.set(URL_PARAM_CRIT, selectedCriterionId)
    else current.delete(URL_PARAM_CRIT)

    const nextStr = current.toString()
    if (nextStr !== prevStr) {
      const url = nextStr ? `${pathname}?${nextStr}` : pathname
      router.replace(url, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jiraKey, selectedCriterionId, pathname, router])
}
