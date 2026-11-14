import { Anchor, Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconCalculator } from '@tabler/icons-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useBond } from '../api/queries';
import type { Bond, Coupon } from '../api/types';
import { BondEventsAndNews } from '../components/BondEventsAndNews';
import { BondPriceChart } from '../components/BondPriceChart';
import { BrokerLinks } from '../components/BrokerLinks';
import { CouponSchedule } from '../components/CouponSchedule';
import { ErrorState } from '../components/ErrorState';
import { RiskBadge } from '../components/RiskBadge';
import {
  couponTypeLabel,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRub,
  formatSector,
  formatSpread,
  formatTimeToMaturity,
  formatTurnover,
  formatYears,
  isRubCurrency,
  plural,
  RATING_AGENCIES,
  RATING_OUTLOOKS,
} from '../lib/format';
import { BondAlertsButton } from '../components/BondAlertsButton';
import { usePageMeta } from '../lib/seo';
import { NotFoundPage } from './NotFoundPage';

export function BondPage() {
  const { ticker = '' } = useParams();
  const query = useBond(ticker);
  usePageMeta(query.data ? bondMeta(query.data) : null);

  if (query.isPending) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <NotFoundPage message={`Облигация ${ticker} не найдена`} />;
    }
    return (
      <Stack>
        <BackLink />
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Stack>
    );
  }

  return <BondDetails bond={query.data} />;
}

/** Те же title и description, что отдаёт gateway на SEO-странице облигации */
function bondMeta(bond: Bond) {
  const name = bond.name ?? bond.ticker;
  const facts = [`${name}${bond.isin ? `, ISIN ${bond.isin}` : ''}`];
  if (bond.price?.percentagePrice != null) {
    facts.push(`цена ${formatPercent(bond.price.percentagePrice)} от номинала`);
  }
  if (bond.coupon?.yieldToMaturity != null) {
    facts.push(`доходность к погашению ${formatPercent(bond.coupon.yieldToMaturity)} годовых`);
  }
  if (bond.maturityDate) {
    facts.push(`погашение ${formatDate(bond.maturityDate)}`);
  }
  return {
    title: `${name} (${bond.ticker}) - цена и доходность облигации`,
    description: `${facts.join(', ')}. График цены, выплаты купонов и новости.`,
    canonicalPath: `/bonds/${encodeURIComponent(bond.ticker)}`,
    ogType: 'article' as const,
  };
}

function BondDetails({ bond }: { bond: Bond }) {
  return (
    <Stack gap="lg">
      <BackLink />

      <Stack gap="xs">
        <Group gap="xs" wrap="nowrap">
          <Title order={2}>{bond.name ?? bond.ticker}</Title>
          <BondAlertsButton ticker={bond.ticker} name={bond.name} />
        </Group>
        <Group gap="xs">
          <Badge variant="outline">{bond.ticker}</Badge>
          {bond.isin && bond.isin !== bond.ticker && (
            <Badge variant="outline" color="gray">
              ISIN {bond.isin}
            </Badge>
          )}
          <RiskBadge level={bond.riskLevel} />
          <Text size="sm" c="dimmed">
            {formatSector(bond.sector)}
          </Text>
          {bond.issuer && (
            <Anchor component={Link} to={`/issuers/${bond.issuer.id}`} size="sm">
              Эмитент: {bond.issuer.shortTitle ?? bond.issuer.id}
            </Anchor>
          )}
        </Group>
        <Button
          component={Link}
          to={`/calculator?ticker=${encodeURIComponent(bond.ticker)}`}
          variant="light"
          leftSection={<IconCalculator size={16} />}
          w="fit-content"
        >
          Рассчитать доход
        </Button>
      </Stack>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
        <Stat label="Текущая цена" value={formatMoney(bond.price?.current)} hint={priceHint(bond)} />
        <Stat
          label="Номинал"
          value={formatMoney(bond.price?.nominal)}
          hint={bond.amortizationFlag ? 'с амортизацией: гасится частями' : undefined}
        />
        <Stat label="НКД" value={formatMoney(bond.price?.aci)} hint="доплачивается продавцу при покупке" />
        <Stat
          label="Купон"
          value={bond.coupon?.interest != null ? `${formatPercent(bond.coupon.interest)} к цене` : '—'}
          hint={bond.coupon ? couponHint(bond.coupon, bond.floaterBaseRate) : 'данных о купоне нет'}
        />
        <Stat
          label="Доходность к погашению"
          value={bond.coupon?.yieldToMaturity != null ? `${formatPercent(bond.coupon.yieldToMaturity)} годовых` : '—'}
          hint={yieldHint(bond)}
        />
        <Stat label="Погашение" value={formatDate(bond.maturityDate)} hint={formatTimeToMaturity(bond.maturityDate)} />
        <RatingStat bond={bond} />
        <Stat label="Дюрация" value={formatYears(bond.coupon?.durationMacaulay)} hint={durationHint(bond.coupon)} />
        <Stat label="Спред к ОФЗ" value={formatSpread(bond.spreadToOfz)} hint={spreadHint(bond)} />
        <Stat label="Оборот в день" value={formatTurnover(bond.liquidity?.avgDailyTurnoverRub)} hint={liquidityHint(bond)} />
      </SimpleGrid>

      <BrokerLinks ticker={bond.ticker} />

      <BondPriceChart ticker={bond.ticker} />

      <BondEventsAndNews ticker={bond.ticker} />

      <CouponSchedule coupon={bond.coupon} />
    </Stack>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={600} mt={4}>
        {value}
      </Text>
      {hint && (
        <Text size="sm" c="dimmed">
          {hint}
        </Text>
      )}
    </Card>
  );
}

/** Возвращает к таблице с теми же фильтрами, если пришли из неё; при открытии по прямой ссылке - на список */
function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromApp = location.key !== 'default';

  return (
    <Anchor
      component="button"
      type="button"
      size="sm"
      onClick={() => (cameFromApp ? navigate(-1) : navigate('/bonds'))}
      w="fit-content"
    >
      <Group gap={4}>
        <IconArrowLeft size={16} />К списку облигаций
      </Group>
    </Anchor>
  );
}

/** «98 % от номинала», у облигаций в валюте ещё и рублёвый эквивалент: «≈ 88 200 ₽ · 98 % от номинала» */
function priceHint(bond: Bond): string {
  const price = bond.price;
  if (price?.percentagePrice == null) {
    return 'цены ещё нет';
  }

  const percent = `${formatPercent(price.percentagePrice)} от номинала`;
  const foreign = price.current?.quantity != null && !isRubCurrency(price.current.currency);
  return foreign && price.currentInRub != null ? `≈ ${formatRub(price.currentInRub)} · ${percent}` : percent;
}

/** «к оферте 12,24 % · 13.01.2027»; без оферты - с чем посчитана доходность */
function yieldHint(bond: Bond): string {
  if (bond.offerDate) {
    const toOffer = bond.coupon?.yieldToOffer != null ? `к оферте ${formatPercent(bond.coupon.yieldToOffer)}` : 'оферта';
    return `${toOffer} · ${formatDate(bond.offerDate)}`;
  }
  return 'с учётом цены, НКД и купонов';
}

/** «постоянный · 12 выплат в год»; у флоатера - база ставки: «переменный, Ключевая ставка · 4 выплаты в год» */
function couponHint(coupon: Coupon, floaterBaseRate?: string | null): string {
  const payments = `${formatNumber(coupon.quantityPerYear)} ${plural(coupon.quantityPerYear, 'выплата', 'выплаты', 'выплат')} в год`;
  const type = couponTypeLabel(coupon.isFixed);
  const typeWithBase = type && floaterBaseRate ? `${type}, ${floaterBaseRate}` : type;
  return typeWithBase ? `${typeWithBase} · ${payments}` : payments;
}

/** Кредитный рейтинг: самый низкий из агентств крупно, под ним рейтинги каждого агентства со ссылкой на релиз */
function RatingStat({ bond }: { bond: Bond }) {
  const ratings = bond.creditRatings ?? (bond.creditRating ? [bond.creditRating] : []);
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        Кредитный рейтинг
      </Text>
      <Text size="xl" fw={600} mt={4}>
        {bond.creditRating?.grade ?? '—'}
      </Text>
      {ratings.length === 0 ? (
        <Text size="sm" c="dimmed">
          нет рейтинга АКРА и НКР
        </Text>
      ) : (
        ratings.map((rating) => (
          <Text key={rating.agency} size="sm" c="dimmed">
            {RATING_AGENCIES[rating.agency]}:{' '}
            {rating.url ? (
              <Anchor href={rating.url} target="_blank" rel="noopener noreferrer" size="sm">
                {rating.rating}
              </Anchor>
            ) : (
              rating.rating
            )}
            {rating.scope === 'ISSUER' ? ' (эмитента)' : ' (выпуска)'}
            {rating.outlook ? `, ${RATING_OUTLOOKS[rating.outlook]}` : ''} · {formatDate(rating.actionDate)}
          </Text>
        ))
      )}
    </Card>
  );
}

/** «модифицированная 2,1: цена −2,1 % при росте доходности на 1 п.п.» */
function durationHint(coupon: Coupon | null): string {
  const modified = coupon?.durationModified;
  if (modified == null) {
    return 'нет доходности к погашению';
  }
  return `модифицированная ${formatNumber(modified)}: цена −${formatNumber(modified)} % при росте доходности на 1 п.п.`;
}

function spreadHint(bond: Bond): string {
  if (bond.ofzCurveYield != null) {
    return `ОФЗ на срок дюрации - ${formatPercent(bond.ofzCurveYield)}`;
  }
  return 'только рублёвые облигации с доходностью к погашению';
}

function liquidityHint(bond: Bond): string {
  const liquidity = bond.liquidity;
  if (!liquidity) {
    return 'свечей по облигации нет';
  }
  return `≈ ${formatNumber(liquidity.avgDailyVolume)} шт. · средний за ${liquidity.periodDays} дней`;
}
