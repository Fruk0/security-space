import rawCriteria from '@/policy/security/criteria.json';
import rawFramework from '@/policy/security/framework.json';
import rawLevels from '@/policy/security/levels.json';
import type { CriterionDef, FrameworkDef, RiskLevelBand } from './domain';

export function loadCriteria(): CriterionDef[] {
  return (rawCriteria as any).criteria as CriterionDef[];
}

export function loadFramework(): FrameworkDef {
  return rawFramework as FrameworkDef;
}

export function loadLevels(): RiskLevelBand[] {
  return (rawLevels as any).levels as RiskLevelBand[];
}
