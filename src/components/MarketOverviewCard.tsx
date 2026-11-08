import type { ReactNode } from 'react';
import { Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { IconArrowDownRight, IconArrowRight, IconArrowUpRight } from '@tabler/icons-react';
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

  const { keyRate, keyRateYearChange, keyRateMeetingDate, keyRateMeetingChange } = query.data;
  const currencies = query.data.currencies ?? [];
  // плитки ставки - в той же сетке, что и курсы: колонки совпадают
  const cols = Math.max(currencies.length, 2);

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
          <SimpleGrid cols={cols} spacing="xs" mt={4}>
            {keyRateYearChange != null && (
              <ChangeTile caption="С начала года">
                <Delta value={keyRateYearChange} suffix=" п.п." />
              </ChangeTile>
            )}
            {keyRateMeetingChange != null && keyRateMeetingDate && (
              <ChangeTile caption={`На заседании ${formatDate(keyRateMeetingDate).slice(0, 5)}`}>
                <Delta value={keyRateMeetingChange} suffix=" п.п." />
              </ChangeTile>
            )}
          </SimpleGrid>
        </Stack>
      )}
      {currencies.length > 0 && (
        <SimpleGrid cols={cols} spacing="xs">
          {currencies.map((currency) => (
            <CurrencyTile key={currency.code} currency={currency} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

/** Плитка изменения ставки - подпись как у кода валюты, ниже стрелка с числом */
function ChangeTile({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" fw={600}>
        {caption}
      </Text>
      {children}
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

/**
 * Рост - зелёным со стрелкой вверх, снижение - красным вниз, без изменения - серым со стрелкой вправо: все изменения
 * выглядят одинаково.
 */
function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  // ставка в п.п. считается вычитанием дробных - убираем хвост вроде 0,25000000000000355
  const rounded = Math.round(value * 10000) / 10000;
  const color = rounded > 0 ? 'teal' : rounded < 0 ? 'red' : 'dimmed';
  const Icon = rounded > 0 ? IconArrowUpRight : rounded < 0 ? IconArrowDownRight : IconArrowRight;
  const iconColor = rounded === 0 ? 'var(--mantine-color-dimmed)' : `var(--mantine-color-${color}-6)`;

  return (
    <Group gap={2} wrap="nowrap">
      <Icon size={12} color={iconColor} aria-hidden />
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
