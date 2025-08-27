'use client'

import * as React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Copy, ExternalLink, Pencil, CheckCircle2 } from 'lucide-react'

type Props = {
  jiraKey: string
  isJiraKeyValid: boolean
  ticketConfirmed: boolean
  jiraUrl?: string | null
  onChangeKey: (value: string) => void
  onConfirm: () => void
  onChangeTicket: () => void
  copyTicketKey: () => void | Promise<void>
  copiedKey?: string | null
}

export default function TicketForm({
  jiraKey,
  isJiraKeyValid,
  ticketConfirmed,
  jiraUrl,
  onChangeKey,
  onConfirm,
  onChangeTicket,
  copyTicketKey,
  copiedKey,
}: Props) {
  if (!ticketConfirmed) {
    return (
      <div className="grid gap-4 md:grid-cols-3 items-end">
        <div className="md:col-span-2">
          <Label htmlFor="jira">Ticket de Jira (KEY)</Label>
          <Input
            id="jira"
            placeholder="CS-123"
            value={jiraKey}
            onChange={(e) => onChangeKey(e.target.value)}
            className={cn(!isJiraKeyValid && jiraKey ? 'ring-1 ring-rose-500' : '')}
          />
          {jiraKey && !isJiraKeyValid && (
            <p className="mt-1 text-xs text-rose-600">
              Formato esperado: ABC-123 o ABCD-123 (máx 4 letras, guión y número).
            </p>
          )}
        </div>
        <Button variant="default" disabled={!isJiraKeyValid} onClick={onConfirm}>
          Confirmar ticket
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <div className="leading-tight">
          <div className="text-xs text-muted-foreground">Ticket confirmado</div>
          <div className="font-semibold tracking-tight">
            <span className="font-mono">{jiraKey}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={copyTicketKey}
          title="Copiar KEY"
          aria-label="Copiar KEY"
        >
          <Copy className="h-4 w-4 mr-2" />
          {copiedKey === 'ok' ? 'Copiado' : 'Copiar'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          asChild
          disabled={!jiraUrl}
          title={jiraUrl ? 'Abrir en Jira' : 'Configura NEXT_PUBLIC_JIRA_BASE_URL'}
          aria-label="Abrir en Jira"
        >
          <a href={jiraUrl ?? '#'} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir
          </a>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onChangeTicket}
          title="Cambiar ticket"
          aria-label="Cambiar ticket"
        >
          <Pencil className="h-4 w-4 mr-2" />
          Cambiar
        </Button>
      </div>
    </div>
  )
}
