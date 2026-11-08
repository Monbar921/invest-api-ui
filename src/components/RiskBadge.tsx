import { Badge } from '@mantine/core';
import type { RiskLevel } from '../api/types';
import { RISK_LEVELS } from '../lib/format';

export function RiskBadge({ level }: { level: RiskLevel | null }) {
  const risk = RISK_LEVELS[level ?? 'RISK_LEVEL_UNSPECIFIED'];
  return (
    // flexShrink: в узкой ячейке бейдж не сжимается до многоточия
    <Badge color={risk.color} variant="light" style={{ flexShrink: 0 }}>
      {risk.label}
    </Badge>
  );
}
