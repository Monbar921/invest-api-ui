import { Anchor, Badge, Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useBond } from '../api/queries';
import type { Bond } from '../api/types';
import { CouponSchedule } from '../components/CouponSchedule';
import { ErrorState } from '../components/ErrorState';
import { RiskBadge } from '../components/RiskBadge';
import { formatDate, formatMoney, formatNumber, formatPercent, formatTimeToMaturity, plural } from '../lib/format';
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
        </Group>
      </Stack>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <Stat
          label="Текущая цена"
          value={formatMoney(bond.price?.current)}
          hint={bond.price?.percentagePrice != null ? `${formatPercent(bond.price.percentagePrice)} от номинала` : 'цены ещё нет'}
        />
        <Stat label="Номинал" value={formatMoney(bond.price?.nominal)} />
        <Stat
          label="Купон"
          value={bond.coupon?.interest != null ? `${formatPercent(bond.coupon.interest)} годовых` : '—'}
          hint={
            bond.coupon
              ? `${formatNumber(bond.coupon.quantityPerYear)} ${plural(bond.coupon.quantityPerYear, 'выплата', 'выплаты', 'выплат')} в год`
              : 'данных о купоне нет'
          }
        />
        <Stat label="Погашение" value={formatDate(bond.maturityDate)} hint={formatTimeToMaturity(bond.maturityDate)} />
      </SimpleGrid>

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
