'use client'

import * as React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type Props = {
  showAccepted: boolean
  showReviewRequested: boolean
  onCopyJiraComment?: () => void | Promise<void>
  copiedComment?: 'ok' | 'err' | null
}

export default function CriteriaStatusCards({
  showAccepted,
  showReviewRequested,
  onCopyJiraComment,
  copiedComment,
}: Props) {
  return (
    <>
      {showAccepted && (
        <Card className="border border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white">Aceptado</Badge>
              <span className="text-sm">
                Ticket aceptado por <strong>criterio de ciberseguridad</strong>.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {showReviewRequested && (
        <Card className="border border-amber-600/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-600 text-white">Revisión solicitada</Badge>
                <span className="text-sm">
                  Se requiere <strong>revisión del criterio de ciberseguridad</strong>.
                </span>
              </div>
              {onCopyJiraComment && (
                <Button
                  onClick={onCopyJiraComment}
                  className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                >
                  {copiedComment === 'ok'
                    ? 'Copiado'
                    : copiedComment === 'err'
                    ? 'Error ❌'
                    : 'Copiar comentario Jira'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
