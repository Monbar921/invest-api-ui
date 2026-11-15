import { BarChart } from '@mantine/charts';
import { Alert, Card, Group, Loader, Progress, SimpleGrid, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { usePortfolioAnalytics } from '../api/queries';
import type {
  PortfolioAnalytics as Analytics,
  PortfolioAnalyticsShare,
  PortfolioAnalyticsWeighted,
  PortfolioUnvaluedReason,
} from '../api/types';
import { formatNumber, formatPercent, formatSector, formatYears, plural } from '../lib/format';
import { money, signedMoney } from '../lib/money';
import { ErrorState } from './ErrorState';

const NO_DATA = 'Нет данных';

const UNVALUED_REASONS: Record<PortfolioUnvaluedReason, string> = {
  UNKNOWN_BOND: 'облигации нет в системе',
  NO_PRICE: 'нет текущей цены',
  NO_RATE: 'нет курса валюты',
};

const COUPON_TYPES: Record<string, string> = {
  FIXED: 'Постоянный купон',
  FLOATING: 'Переменный купон (флоатер)',
};

const compactNumberFormat = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * «Аналитика» портфеля: структура (доли по эмитентам, секторам, рейтингам, валютам и типу купона, лестница
 * погашений) и риск (средние доходность и дюрация, крупнейший эмитент, чувствительность к ставке). Доли - от
 * стоимости в рублях по текущей цене; позиции без признака - в строке «Нет данных», без оценки - отдельно.
 */
export function PortfolioAnalytics() {
  const analytics = usePortfolioAnalytics();
  if (analytics.isPending) {
    return <Loader size="sm" />;
  }
  if (analytics.isError) {
    return <ErrorState error={analytics.error} onRetry={() => void analytics.refetch()} />;
  }
  const data = analytics.data;
  if (data.bonds === 0) {
    return (
      <Text c="dimmed">Аналитика появится, когда в портфеле будут облигации: добавьте покупку или импортируйте сделки.</Text>
    );
  }
  return (
    <Stack gap="lg">
      {data.unvalued.length > 0 && <Unvalued unvalued={data.unvalued} />}
      {data.valueInRub != null && (
        <>
          <Summary data={data} />
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <ShareCard title="Эмитенты" shares={data.issuers} label={(share) => share.title ?? `Эмитент ${share.key}`} />
            <ShareCard title="Секторы" shares={data.sectors} label={(share) => formatSector(share.key)} />
            <ShareCard
              title="Кредитный рейтинг"
              shares={data.ratings}
              label={(share) => share.title ?? share.key ?? NO_DATA}
              noDataLabel="Без рейтинга АКРА и НКР"
            />
            <Stack gap="lg">
              <ShareCard
                title="Валюта номинала"
                shares={data.currencies}
                label={(share) => share.key?.toUpperCase() ?? NO_DATA}
              />
              <ShareCard
                title="Тип купона"
                shares={data.couponTypes}
                label={(share) => COUPON_TYPES[share.key ?? ''] ?? share.key ?? NO_DATA}
              />
            </Stack>
          </SimpleGrid>
          <MaturityLadder shares={data.maturities} />
        </>
      )}
    </Stack>
  );
}

function Unvalued({ unvalued }: { unvalued: Analytics['unvalued'] }) {
  return (
    <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Не вошли в доли">
      <Text size="sm" mb={4}>
        Эти облигации нельзя оценить в рублях - в долях и средних их нет:
      </Text>
      {unvalued.map((position) => (
        <Text size="sm" key={position.ticker}>
          {position.bondName ?? position.ticker} ({position.ticker}) - {UNVALUED_REASONS[position.reason]}
        </Text>
      ))}
    </Alert>
  );
}

function Summary({ data }: { data: Analytics }) {
  const sensitivity = data.rateSensitivity;
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
      <Stat title="Стоимость" value={money(data.valueInRub, 'rub')}>
        по текущей цене без НКД, {data.bonds - data.unvalued.length}{' '}
        {plural(data.bonds - data.unvalued.length, 'облигация', 'облигации', 'облигаций')}
      </Stat>
      <Stat title="Доходность к погашению" value={formatPercent(data.yieldToMaturity.value)}>
        средняя по стоимости
        <Covered weighted={data.yieldToMaturity} />
      </Stat>
      <Stat title="Дюрация" value={formatYears(data.durationMacaulay.value)}>
        модифицированная {formatYears(data.durationModified.value)}
        <Covered weighted={data.durationMacaulay} />
      </Stat>
      <Stat title="Крупнейший эмитент" value={data.largestIssuer ? formatPercent(data.largestIssuer.share) : '—'}>
        {data.largestIssuer ? (data.largestIssuer.title ?? `эмитент ${data.largestIssuer.key}`) : 'эмитенты облигаций неизвестны'}
      </Stat>
      <Card withBorder padding="md" style={{ gridColumn: '1 / -1' }}>
        <Text size="sm" c="dimmed">
          Чувствительность к ставке
        </Text>
        {sensitivity ? (
          <>
            <Group gap="xl" mt={4}>
              <Text fw={600}>
                доходность +{formatNumber(sensitivity.shiftPercent)} п.п.: {signedMoney(sensitivity.valueChangeUp, 'rub')} (−
                {formatPercent(sensitivity.changePercent)})
              </Text>
              <Text fw={600}>
                доходность −{formatNumber(sensitivity.shiftPercent)} п.п.: {signedMoney(sensitivity.valueChangeDown, 'rub')} (+
                {formatPercent(sensitivity.changePercent)})
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Оценка через модифицированную дюрацию, по {formatPercent(sensitivity.coveredShare)} стоимости портфеля: флоатеры и
              облигации без дюрации не учтены.
            </Text>
          </>
        ) : (
          <Text size="sm" mt={4}>
            Нет облигаций с постоянным купоном и известной дюрацией.
          </Text>
        )}
      </Card>
    </SimpleGrid>
  );
}

function Stat({ title, value, children }: { title: string; value: string; children: ReactNode }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        {title}
      </Text>
      <Text fw={700} size="xl">
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {children}
      </Text>
    </Card>
  );
}

/** «по 70 % стоимости» - только если в среднее вошло не всё */
function Covered({ weighted }: { weighted: PortfolioAnalyticsWeighted }) {
  if (weighted.value == null) {
    return <>, данных нет</>;
  }
  return weighted.coveredShare < 100 ? <>, по {formatPercent(weighted.coveredShare)} стоимости</> : null;
}

/** Доли одного разреза полосками; «нет данных» - последней строкой, серой */
function ShareCard({
  title,
  shares,
  label,
  noDataLabel = NO_DATA,
}: {
  title: string;
  shares: PortfolioAnalyticsShare[];
  label: (share: PortfolioAnalyticsShare) => string;
  noDataLabel?: string;
}) {
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        {title}
      </Title>
      <Stack gap="xs">
        {shares.map((share) => {
          const name = share.key == null ? noDataLabel : label(share);
          return (
            <div key={share.key ?? '∅'} data-testid="share-row">
              <Group justify="space-between" gap="xs" wrap="nowrap">
                <Tooltip label={share.tickers.join(', ')} multiline maw={320}>
                  <Text size="sm" truncate c={share.key == null ? 'dimmed' : undefined}>
                    {name}
                  </Text>
                </Tooltip>
                <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
                  {formatPercent(share.share)}
                </Text>
              </Group>
              <Progress
                value={share.share}
                color={share.key == null ? 'gray.5' : 'teal.6'}
                size="sm"
                aria-label={`${name}: ${formatPercent(share.share)}`}
              />
              <Text size="xs" c="dimmed">
                {money(share.valueInRub, 'rub')}
              </Text>
            </div>
          );
        })}
      </Stack>
    </Card>
  );
}

/** Лестница погашений: стоимость по году даты погашения */
function MaturityLadder({ shares }: { shares: PortfolioAnalyticsShare[] }) {
  const withoutDate = shares.find((share) => share.key == null);
  const years = shares.filter((share) => share.key != null);
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        Погашения по годам, ₽
      </Title>
      <BarChart
        h={220}
        data={years.map((share) => ({ year: share.key, value: share.valueInRub, share: share.share }))}
        dataKey="year"
        series={[{ name: 'value', label: 'Стоимость', color: 'teal.6' }]}
        valueFormatter={(value) => money(value, 'rub')}
        yAxisProps={{ width: 64, tickFormatter: (value: number) => compactNumberFormat.format(value) }}
        tickLine="y"
      />
      <Group gap="md" mt="xs">
        {years.map((share) => (
          <Text size="xs" key={share.key}>
            {share.key}: {formatPercent(share.share)}
          </Text>
        ))}
      </Group>
      {withoutDate && (
        <Text size="xs" c="dimmed" mt="xs">
          Без даты погашения: {formatPercent(withoutDate.share)} ({money(withoutDate.valueInRub, 'rub')})
        </Text>
      )}
      <Text size="xs" c="dimmed" mt="xs">
        По дате погашения; оферты и амортизация не учитываются - они есть во вкладке «Выплаты».
      </Text>
    </Card>
  );
}
