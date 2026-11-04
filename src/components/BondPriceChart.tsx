import { AreaChart } from '@mantine/charts';
import { Card, Group, Loader, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useBondCandles } from '../api/queries';
import type { Candle, CandleInterval } from '../api/types';
import { periodStart, type ChartPeriod } from '../lib/dates';
import { formatDate, formatNumber, formatPercent } from '../lib/format';
import { ErrorState } from './ErrorState';

const INTERVALS: { value: CandleInterval; label: string }[] = [
  { value: 'DAY', label: 'Д' },
  { value: 'WEEK', label: 'Н' },
  { value: 'MONTH', label: 'Мес' },
];

const PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: '1M', label: '1М' },
  { value: '6M', label: '6М' },
  { value: '1Y', label: '1Г' },
  { value: '3Y', label: '3Г' },
  { value: 'ALL', label: 'Всё' },
];

/** График цены облигации в % от номинала по дневным свечам; неделя и месяц собираются на бэке */
export function BondPriceChart({ ticker }: { ticker: string }) {
  const [interval, setInterval] = useState<CandleInterval>('DAY');
  const [period, setPeriod] = useState<ChartPeriod>('1Y');
  const query = useBondCandles(ticker, interval, periodStart(period));

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={0}>
            <Title order={4}>Цена, % номинала</Title>
            {query.data && <PeriodSummary candles={query.data} />}
          </Stack>
          <Group gap="xs">
            <SegmentedControl
              size="xs"
              aria-label="Интервал свечей"
              data={INTERVALS}
              value={interval}
              onChange={(value) => setInterval(value as CandleInterval)}
            />
            <SegmentedControl
              size="xs"
              aria-label="Период"
              data={PERIODS}
              value={period}
              onChange={(value) => setPeriod(value as ChartPeriod)}
            />
          </Group>
        </Group>

        {query.isPending ? (
          <Group justify="center" h={280}>
            <Loader size="sm" />
          </Group>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : query.data.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {period === 'ALL' ? 'Сделок по облигации ещё не было' : 'Сделок за период не было'}
          </Text>
        ) : (
          <AreaChart
            h={280}
            data={query.data.map((candle) => ({ ...candle, label: formatDate(candle.date) }))}
            dataKey="label"
            series={[{ name: 'close', label: 'Закрытие', color: 'blue.6' }]}
            curveType="linear"
            withDots={false}
            withGradient
            // неликвидные облигации торгуются в узком коридоре - ось от минимума к максимуму, а не от нуля
            yAxisProps={{ domain: ['dataMin', 'dataMax'] }}
            valueFormatter={(value) => formatPercent(value)}
            style={{ opacity: query.isFetching ? 0.6 : 1 }}
          />
        )}
      </Stack>
    </Card>
  );
}

/** «101,2 % · +1,2 п.п. за период» - последняя цена закрытия и изменение от первой свечи периода */
function PeriodSummary({ candles }: { candles: Candle[] }) {
  if (candles.length === 0) {
    return null;
  }
  const first = candles[0]!;
  const last = candles[candles.length - 1]!;
  const change = Math.round((last.close - first.open) * 100) / 100;
  const color = change > 0 ? 'teal' : change < 0 ? 'red' : 'dimmed';

  return (
    <Group gap="xs">
      <Text fw={600}>{formatPercent(last.close)}</Text>
      <Text size="sm" c={color}>
        {change > 0 ? '+' : ''}
        {formatNumber(change)} п.п. с {formatDate(first.date)}
      </Text>
    </Group>
  );
}
