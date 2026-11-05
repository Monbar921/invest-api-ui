import { Anchor, Badge, Button, Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconCalculator } from '@tabler/icons-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useBond } from '../api/queries';
import type { Bond, Coupon } from '../api/types';
import { BondEventsAndNews } from '../components/BondEventsAndNews';
import { BondPriceChart } from '../components/BondPriceChart';
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
  formatTimeToMaturity,
  isRubCurrency,
  plural,
} from '../lib/format';
import { NotFoundPage } from './NotFoundPage';

export function BondPage() {
  const { ticker = '' } = useParams();
  const query = useBond(ticker);

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

function BondDetails({ bond }: { bond: Bond }) {
  return (
    <Stack gap="lg">
      <BackLink />

      <Stack gap="xs">
        <Title order={2}>{bond.name ?? bond.ticker}</Title>
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
          hint={bond.coupon ? couponHint(bond.coupon) : 'данных о купоне нет'}
        />
        <Stat
          label="Доходность к погашению"
          value={bond.coupon?.yieldToMaturity != null ? `${formatPercent(bond.coupon.yieldToMaturity)} годовых` : '—'}
          hint={yieldHint(bond)}
        />
        <Stat label="Погашение" value={formatDate(bond.maturityDate)} hint={formatTimeToMaturity(bond.maturityDate)} />
      </SimpleGrid>

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

/** «постоянный · 12 выплат в год» */
function couponHint(coupon: Coupon): string {
  const payments = `${formatNumber(coupon.quantityPerYear)} ${plural(coupon.quantityPerYear, 'выплата', 'выплаты', 'выплат')} в год`;
  const type = couponTypeLabel(coupon.isFixed);
  return type ? `${type} · ${payments}` : payments;
}
