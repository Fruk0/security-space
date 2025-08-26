import type { FrameworkDef, FrameworkAnswers, RiskLevelBand, QA } from './domain';

export function bandForScore(levels: RiskLevelBand[], score: number): string {
  // Semántica: [min, next.min). Si score == next.min => cae en la banda siguiente.
  // Ej.: Low[0,10), Medium[10,20), High[20,∞)
  for (let i = 0; i < levels.length; i++) {
    const curr = levels[i];
    const next = levels[i + 1];
    if (!next) return curr.key;               // Última banda
    if (score >= curr.min && score < next.min) return curr.key;
  }
  return levels[levels.length - 1].key;
}
