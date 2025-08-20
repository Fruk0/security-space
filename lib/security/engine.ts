import type {
  CriterionDef, CriterionAnswers, DecisionStatus, DecisionLabel, QA,
  FrameworkDef, FrameworkAnswers, RiskLevelBand, RiskLevelKey
} from './domain';

export function evalCriterion(def: CriterionDef, answers: CriterionAnswers): {
  status: DecisionStatus; label: DecisionLabel; allYes: boolean;
} {
  const qs = def.questions;
  const answered = qs.filter(q => answers[q.id] !== undefined).length;
  if (answered === 0) return { status: 'pending', label: 'PENDIENTE', allYes: false };

  const allYes = qs.every(q => answers[q.id] === 'yes');
  const hasUnknown = qs.some(q => answers[q.id] === 'unknown');
  const incomplete = answered < qs.length;

  const status: DecisionStatus =
    allYes ? 'pass' : (hasUnknown || incomplete) ? 'fail' : 'fail';
  const label: DecisionLabel = allYes ? 'PASA' : (hasUnknown || incomplete) ? 'REVISAR' : 'NO PASA';

  return { status, label, allYes };
}

export function shouldCount(riskWhen: any, a: QA | undefined) {
  if (!a || !riskWhen) return false;
  if (riskWhen === 'yes') return a === 'yes';
  if (riskWhen === 'no') return a === 'no';
  if (riskWhen === 'unknown') return a === 'unknown';
  if (riskWhen === 'no_or_unknown') return a === 'no' || a === 'unknown';
  if (riskWhen === 'yes_or_unknown') return a === 'yes' || a === 'unknown';
  return false;
}

export function evalFramework(def: FrameworkDef, levels: RiskLevelBand[], answers: FrameworkAnswers) {
  const score = def.questions.reduce((acc, q) => acc + (shouldCount(q.riskWhen, answers[q.id]) ? q.weight : 0), 0);
  const level = (levels.find(l => score >= l.min && score <= l.max)?.key ?? 'Low') as RiskLevelKey;
  const allAnswered = Object.keys(answers).length === def.questions.length;
  return { score, level, allAnswered };
}
