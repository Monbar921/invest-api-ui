import { Anchor, Badge, Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { useBond } from '../api/queries';
import type { Bond } from '../api/types';
import { BondSearch } from '../components/BondSearch';
import { BrokerLinks } from '../components/BrokerLinks';
import { ErrorState } from '../components/ErrorState';
import { ProfitCalculator } from '../components/ProfitCalculator';
import { RiskBadge } from '../components/RiskBadge';
import { usePageMeta } from '../lib/seo';
import { couponTypeLabel, formatDate, formatMoney, formatPercent, formatSector, formatTimeToMaturity } from '../lib/format';

/** Калькулятор дохода: выбор облигации поиском, её основные показатели и расчёт дохода за период владения */
export function CalculatorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const ticker = searchParams.get('ticker');
  usePageMeta({
    title: 'Калькулятор дохода по облигации',
    description:
      'Доход по облигации за период владения: купоны, погашения номинала, продажа, НДФЛ 13 или 15% и сравнение с вкладом.',
    canonicalPath: '/calculator',
  });

  return (
    <Stack gap="lg">
      <Title order={2}>Калькулятор дохода</Title>
      {/* тикер в URL: расчёт можно открыть из карточки облигации и сохранить ссылкой */}
      {ticker ? (
        <SelectedBond ticker={ticker} onChange={(next) => setSearchParams(next ? { ticker: next } : {})} />
      ) : (
        <BondSearch value={null} onChange={(next) => setSearchParams(next ? { ticker: next } : {})} />
      )}
    </Stack>
  );
}

function SelectedBond({ ticker, onChange }: { ticker: string; onChange: (ticker: string | null) => void }) {
  const query = useBond(ticker);

  return (
    <Stack gap="lg">
      {/* key: после выбора другой облигации поле поиска начинается с её подписи */}
      <BondSearch key={ticker} value={ticker} selectedName={query.data?.name} onChange={onChange} />
      {query.isPending ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : query.isError ? (
        <ErrorState
          error={
            query.error instanceof ApiError && query.error.status === 404
              ? new Error(`Облигация ${ticker} не найдена`)
              : query.error
          }
          onRetry={() => query.refetch()}
        />
      ) : (
        <>
          <BondSummary bond={query.data} />
          {/* key: форма другой облигации начинается с её цены и дат */}
          <ProfitCalculator key={query.data.ticker} bond={query.data} />
          <BrokerLinks ticker={query.data.ticker} />
        </>
      )}
    </Stack>
  );
}

function BondSummary({ bond }: { bond: Bond }) {
  const coupon = bond.coupon;
  const couponType = couponTypeLabel(coupon?.isFixed);

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Anchor component={Link} to={`/bonds/${encodeURIComponent(bond.ticker)}`} fw={600} size="lg">
          {bond.name ?? bond.ticker}
        </Anchor>
        <Badge variant="outline">{bond.ticker}</Badge>
        <RiskBadge level={bond.riskLevel} />
        <Text size="sm" c="dimmed">
          {formatSector(bond.sector)}
        </Text>
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
        <SummaryStat
          label="Текущая цена"
          value={formatMoney(bond.price?.current)}
          hint={bond.price?.percentagePrice != null ? `${formatPercent(bond.price.percentagePrice)} от номинала` : 'цены ещё нет'}
        />
        <SummaryStat
          label="Купон"
          value={formatPercent(coupon?.interest)}
          hint={couponType ? `${couponType}, годовых к цене` : 'годовых к цене'}
        />
        <SummaryStat label="К погашению" value={formatPercent(coupon?.yieldToMaturity)} hint="годовых, с НКД" />
        <SummaryStat
          label="К оферте"
          value={formatPercent(coupon?.yieldToOffer)}
          hint={bond.offerDate ? `оферта ${formatDate(bond.offerDate)}` : 'оферты нет'}
        />
        <SummaryStat label="Погашение" value={formatDate(bond.maturityDate)} hint={formatTimeToMaturity(bond.maturityDate)} />
      </SimpleGrid>
    </Stack>
  );
}

function SummaryStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card withBorder padding="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="lg" fw={600} mt={2}>
        {value}
      </Text>
      <Text size="xs" c="dimmed">
        {hint}
      </Text>
    </Card>
  );
}
