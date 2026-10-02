import { Button, Group, MultiSelect, Paper, SegmentedControl, Stack, Text } from '@mantine/core';
import { IconFilterOff } from '@tabler/icons-react';
import type { RiskLevel } from '../api/types';
import type { BondSearchState, OfzFilter } from '../lib/bondSearchParams';
import { FILTERABLE_RISK_LEVELS, RISK_LEVELS } from '../lib/format';
import { DebouncedNumberInput } from './DebouncedNumberInput';

interface Props {
  state: BondSearchState;
  onChange: (patch: Partial<BondSearchState>) => void;
  onReset: () => void;
}

const RISK_OPTIONS = FILTERABLE_RISK_LEVELS.map((level) => ({ value: level, label: RISK_LEVELS[level].label }));

const OFZ_OPTIONS: { value: OfzFilter; label: string }[] = [
  { value: 'any', label: 'Все' },
  { value: 'only', label: 'Только ОФЗ' },
  { value: 'exclude', label: 'Без ОФЗ' },
];

export function BondFilters({ state, onChange, onReset }: Props) {
  const hasFilters =
    state.priceMin !== undefined ||
    state.priceMax !== undefined ||
    state.percentMin !== undefined ||
    state.percentMax !== undefined ||
    state.riskLevels.length > 0 ||
    state.ofz !== 'any';

  return (
    <Paper withBorder p="md">
      <Group align="flex-end" gap="lg" wrap="wrap">
        <RangeFilter
          label="Цена, ₽"
          hint="валютные — по курсу ЦБ"
          min={state.priceMin}
          max={state.priceMax}
          onMinChange={(priceMin) => onChange({ priceMin })}
          onMaxChange={(priceMax) => onChange({ priceMax })}
        />
        <RangeFilter
          label="Цена, % от номинала"
          min={state.percentMin}
          max={state.percentMax}
          onMinChange={(percentMin) => onChange({ percentMin })}
          onMaxChange={(percentMax) => onChange({ percentMax })}
        />
        <MultiSelect
          label="Риск"
          placeholder={state.riskLevels.length === 0 ? 'Любой' : undefined}
          data={RISK_OPTIONS}
          value={state.riskLevels}
          onChange={(riskLevels) => onChange({ riskLevels: riskLevels as RiskLevel[] })}
          clearable
          w={260}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            ОФЗ
          </Text>
          <SegmentedControl data={OFZ_OPTIONS} value={state.ofz} onChange={(ofz) => onChange({ ofz: ofz as OfzFilter })} />
        </Stack>
        <Button variant="subtle" leftSection={<IconFilterOff size={16} />} onClick={onReset} disabled={!hasFilters}>
          Сбросить
        </Button>
      </Group>
    </Paper>
  );
}

interface RangeFilterProps {
  label: string;
  hint?: string;
  min: number | undefined;
  max: number | undefined;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
}

function RangeFilter({ label, hint, min, max, onMinChange, onMaxChange }: RangeFilterProps) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {label}
        {hint && (
          <Text span size="xs" c="dimmed" ml={6}>
            {hint}
          </Text>
        )}
      </Text>
      <Group gap="xs" wrap="nowrap">
        <DebouncedNumberInput
          aria-label={`${label}: от`}
          placeholder="от"
          value={min}
          onChange={onMinChange}
          min={0}
          decimalSeparator=","
          thousandSeparator=" "
          hideControls
          w={110}
        />
        <DebouncedNumberInput
          aria-label={`${label}: до`}
          placeholder="до"
          value={max}
          onChange={onMaxChange}
          min={0}
          decimalSeparator=","
          thousandSeparator=" "
          hideControls
          w={110}
        />
      </Group>
    </Stack>
  );
}
