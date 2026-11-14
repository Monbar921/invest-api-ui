import { Button, Collapse, Group, MultiSelect, Paper, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconFilterOff } from '@tabler/icons-react';
import { useState } from 'react';
import { useSectors } from '../api/queries';
import type { RiskLevel } from '../api/types';
import {
  COUPON_FREQUENCIES,
  hasFilters,
  hasScreenerFilters,
  type BondSearchState,
  type CouponTypeFilter,
  type OfzFilter,
  type PresenceFilter,
} from '../lib/bondSearchParams';
import { FILTERABLE_RISK_LEVELS, formatSector, plural, RATING_GRADES, RISK_LEVELS } from '../lib/format';
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

const COUPON_TYPE_OPTIONS: { value: CouponTypeFilter; label: string }[] = [
  { value: 'any', label: 'Все' },
  { value: 'fixed', label: 'Постоянный' },
  { value: 'floating', label: 'Переменный' },
];

const PRESENCE_OPTIONS: { value: PresenceFilter; label: string }[] = [
  { value: 'any', label: 'Все' },
  { value: 'with', label: 'Есть' },
  { value: 'without', label: 'Нет' },
];

const FREQUENCY_OPTIONS = COUPON_FREQUENCIES.map((frequency) => ({
  value: String(frequency),
  label: `${frequency} ${plural(frequency, 'раз', 'раза', 'раз')} в год`,
}));

// «не ниже» самой нижней ступени - то же, что без фильтра, кроме облигаций без рейтинга
const RATING_OPTIONS = RATING_GRADES.map((grade) => ({ value: grade, label: `не ниже ${grade}` }));

export function BondFilters({ state, onChange, onReset }: Props) {
  // панель скринера открыта сразу, если по ссылке пришли с её фильтрами
  const [moreOpened, setMoreOpened] = useState(() => hasScreenerFilters(state));
  const sectors = useSectors(moreOpened);

  return (
    <Paper withBorder p="md">
      <Stack gap="md">
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
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Купон
            </Text>
            <SegmentedControl
              data={COUPON_TYPE_OPTIONS}
              value={state.couponType}
              onChange={(couponType) => onChange({ couponType: couponType as CouponTypeFilter })}
            />
          </Stack>
          <Button
            variant={moreOpened ? 'light' : 'subtle'}
            leftSection={<IconAdjustmentsHorizontal size={16} />}
            onClick={() => setMoreOpened((opened) => !opened)}
            aria-expanded={moreOpened}
          >
            Ещё фильтры
          </Button>
          <Button variant="subtle" leftSection={<IconFilterOff size={16} />} onClick={onReset} disabled={!hasFilters(state)}>
            Сбросить
          </Button>
        </Group>

        <Collapse expanded={moreOpened}>
          <Group align="flex-end" gap="lg" wrap="wrap">
            <Select
              label="Кредитный рейтинг"
              description="АКРА и НКР, самый низкий"
              placeholder="Любой"
              data={RATING_OPTIONS}
              value={state.ratingMin ?? null}
              onChange={(ratingMin) => onChange({ ratingMin: ratingMin ?? undefined })}
              clearable
              w={200}
            />
            <RangeFilter
              label="Доходность к погашению, %"
              min={state.ytmMin}
              max={state.ytmMax}
              onMinChange={(ytmMin) => onChange({ ytmMin })}
              onMaxChange={(ytmMax) => onChange({ ytmMax })}
            />
            <RangeFilter
              label="Спред к ОФЗ, п.п."
              min={state.spreadMin}
              max={state.spreadMax}
              allowNegative
              onMinChange={(spreadMin) => onChange({ spreadMin })}
              onMaxChange={(spreadMax) => onChange({ spreadMax })}
            />
            <RangeFilter
              label="Дюрация, лет"
              min={state.durationMin}
              max={state.durationMax}
              onMinChange={(durationMin) => onChange({ durationMin })}
              onMaxChange={(durationMax) => onChange({ durationMax })}
            />
            <RangeFilter
              label="До погашения, лет"
              min={state.yearsMin}
              max={state.yearsMax}
              onMinChange={(yearsMin) => onChange({ yearsMin })}
              onMaxChange={(yearsMax) => onChange({ yearsMax })}
            />
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Оборот в день, ₽
                <Text span size="xs" c="dimmed" ml={6}>
                  средний за 30 дней
                </Text>
              </Text>
              <DebouncedNumberInput
                aria-label="Оборот в день, ₽: от"
                placeholder="от"
                value={state.turnoverMin}
                onChange={(turnoverMin) => onChange({ turnoverMin })}
                min={0}
                decimalSeparator=","
                thousandSeparator=" "
                hideControls
                w={160}
              />
            </Stack>
            <MultiSelect
              label="Сектор"
              placeholder={state.sectors.length === 0 ? 'Любой' : undefined}
              data={sectorOptions(sectors.data, state.sectors)}
              value={state.sectors}
              onChange={(selected) => onChange({ sectors: selected })}
              clearable
              searchable
              w={260}
            />
            <MultiSelect
              label="Выплат купона"
              placeholder={state.frequencies.length === 0 ? 'Любое число' : undefined}
              data={FREQUENCY_OPTIONS}
              value={state.frequencies.map(String)}
              onChange={(selected) => onChange({ frequencies: selected.map(Number) })}
              clearable
              w={240}
            />
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Оферта
              </Text>
              <SegmentedControl
                data={PRESENCE_OPTIONS}
                value={state.offer}
                onChange={(offer) => onChange({ offer: offer as PresenceFilter })}
              />
            </Stack>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                Амортизация
              </Text>
              <SegmentedControl
                data={PRESENCE_OPTIONS}
                value={state.amortization}
                onChange={(amortization) => onChange({ amortization: amortization as PresenceFilter })}
              />
            </Stack>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            Облигации без значения (нет рейтинга, дюрации, сделок) под заданный фильтр не попадают.
          </Text>
        </Collapse>
      </Stack>
    </Paper>
  );
}

/** Секторы с бэка по-русски; выбранные из ссылки показываются, даже пока список не загрузился */
function sectorOptions(loaded: string[] | undefined, selected: string[]) {
  const values = [...new Set([...(loaded ?? []), ...selected])];
  return values.map((sector) => ({ value: sector, label: formatSector(sector) }));
}

interface RangeFilterProps {
  label: string;
  hint?: string;
  min: number | undefined;
  max: number | undefined;
  /** Значение может быть отрицательным (спред) */
  allowNegative?: boolean;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
}

function RangeFilter({ label, hint, min, max, allowNegative = false, onMinChange, onMaxChange }: RangeFilterProps) {
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
          min={allowNegative ? undefined : 0}
          allowNegative={allowNegative}
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
          min={allowNegative ? undefined : 0}
          allowNegative={allowNegative}
          decimalSeparator=","
          thousandSeparator=" "
          hideControls
          w={110}
        />
      </Group>
    </Stack>
  );
}
