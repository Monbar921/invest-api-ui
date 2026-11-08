import { Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import { useMarketOverview } from '../api/queries';
import type { CurrencyRate, MarketOverview } from '../api/types';
import { formatChange, formatDate, formatNumber, formatPercent } from '../lib/format';

/** Ключевая ставка и курсы ЦБ. ЦБ не ответил - блок просто не показывается, лента от этого не страдает */
export function MarketOverviewCard() {
  const query = useMarketOverview();

  if (query.isPending) {
    return <Skeleton h={88} />;
  }
  if (query.isError || !hasData(query.data)) {
    return null;
  }

  const { keyRate, keyRateSince, previousKeyRate, keyRateYearChange, keyRateMeetingDate, keyRateMeetingChange } = query.data;
  const currencies = query.data.currencies ?? [];

  return (
    <Stack gap="xs">
      {keyRate != null && (
        <Stack gap={0}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Ключевая ставка
          </Text>
          <Text size="xl" fw={600}>
            {formatPercent(keyRate)}
          </Text>
          <Group gap="md">
            {keyRateYearChange != null && <Delta value={keyRateYearChange} suffix=" п.п. с начала года" />}
            {keyRateMeetingChange != null && keyRateMeetingDate && (
              <Delta value={keyRateMeetingChange} suffix={` п.п. на заседании ${formatDate(keyRateMeetingDate)}`} />
            )}
          </Group>
          {keyRateSince && (
            <Text size="xs" c="dimmed">
              с {formatDate(keyRateSince)}
              {previousKeyRate != null && `, до этого ${formatPercent(previousKeyRate)}`}
            </Text>
          )}
        </Stack>
      )}
      {currencies.length > 0 && (
        <SimpleGrid cols={currencies.length} spacing="xs">
          {currencies.map((currency) => (
            <CurrencyTile key={currency.code} currency={currency} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

function CurrencyTile({ currency }: { currency: CurrencyRate }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed" fw={600}>
        {currency.code}
      </Text>
      <Text size="sm" fw={600}>
        {formatNumber(currency.rate)} ₽
      </Text>
      <Delta value={currency.change} />
    </Stack>
  );
}

/** Рост - зелёным со стрелкой вверх, снижение - красным; без изменения - серым */
function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  // ставка в п.п. считается вычитанием дробных - убираем хвост вроде 0,25000000000000355
  const rounded = Math.round(value * 10000) / 10000;
  const color = rounded > 0 ? 'teal' : rounded < 0 ? 'red' : 'dimmed';
  const Icon = rounded > 0 ? IconArrowUpRight : rounded < 0 ? IconArrowDownRight : null;

  return (
    <Group gap={2} wrap="nowrap">
      {Icon && <Icon size={12} color={`var(--mantine-color-${color}-6)`} aria-hidden />}
      <Text size="xs" c={color}>
        {formatChange(rounded)}
        {suffix}
      </Text>
    </Group>
  );
}

function hasData(overview: MarketOverview): boolean {
  return overview.keyRate != null || (overview.currencies?.length ?? 0) > 0;
}
