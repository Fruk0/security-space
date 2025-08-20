// Respuestas base
export type QA = 'yes' | 'no' | 'unknown';

// Criterios
export type CriterionId = 'C1' | 'C2' | 'C3' | 'C4' | (string & {});

export type CriterionQuestion = {
  id: string;
  text: string;
  requiresJustificationWhen?: QA[]; // p.ej. ['yes']
};

export type CriterionDef = {
  id: CriterionId;
  title: string;
  description?: string;
  passRule: { type: 'allYes' } | { type: 'all'; require?: Record<string, QA> };
  questions: CriterionQuestion[];
};

// Framework de riesgo
export type RiskWhen = 'yes' | 'no' | 'unknown' | 'yes_or_unknown' | 'no_or_unknown';

export type FrameworkQuestion = {
  id: string;
  text: string;
  weight: number;
  riskType: string;
  riskWhen: RiskWhen;
};

export type FrameworkDef = {
  questions: FrameworkQuestion[];
};

export type RiskLevelKey = 'Low' | 'Medium' | 'High';
export type RiskLevelBand = { key: RiskLevelKey; min: number; max: number; color: string };

// Decisiones
export type DecisionStatus = 'pending' | 'pass' | 'fail';
export type DecisionLabel = 'PENDIENTE' | 'PASA' | 'REVISAR' | 'NO PASA';

export type CriterionAnswers = Record<string, QA>;
export type FrameworkAnswers = Record<string, QA>;
