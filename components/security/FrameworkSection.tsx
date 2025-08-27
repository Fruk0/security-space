'use client'

import * as React from 'react'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { QA } from '@/lib/security/domain'

type FrameworkQuestion = { id: string; text: string; riskType: string; weight: number }
type FrameworkDef = { questions: FrameworkQuestion[] }

type Props = {
  FRAMEWORK: FrameworkDef
  level: string
  score: number
  levelColor: string
  progressPct: number
  answers: Record<string, QA>
  onSetAnswer: (qid: string, value: QA) => void
}

export default function FrameworkSection({
  FRAMEWORK,
  level,
  score,
  levelColor,
  progressPct,
  answers,
  onSetAnswer,
}: Props) {
  return (
    <div className="space-y-6">
      <Separator />
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Framework de Security Risk</h3>
          <p className="text-sm text-muted-foreground">
            Respondé Sí / No / No sé. El score se calcula automáticamente.
          </p>
        </div>
        <Badge className={cn('text-white', levelColor)}>
          {level} • {score} pts
        </Badge>
      </div>

      <Progress value={progressPct} />

      <div className="space-y-4">
        {FRAMEWORK.questions.map((q) => (
          <Card key={q.id} className="border">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{q.text}</span>
                  <Badge variant="secondary">
                    {q.riskType} · +{q.weight}
                  </Badge>
                </div>

                <RadioGroup
                  className="flex gap-6"
                  value={answers[q.id] ?? ''}
                  onValueChange={(v: string) => onSetAnswer(q.id, v as QA)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id={`${q.id}-yes`} value="yes" />
                    <Label htmlFor={`${q.id}-yes`}>Sí</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id={`${q.id}-no`} value="no" />
                    <Label htmlFor={`${q.id}-no`}>No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id={`${q.id}-unknown`} value="unknown" />
                    <Label htmlFor={`${q.id}-unknown`}>No sé</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
