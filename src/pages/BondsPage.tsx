import { Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useBondsPage } from '../api/queries';
import type { BondScope } from '../api/types';
import { BondFilters } from '../components/BondFilters';
import { BondsTable } from '../components/BondsTable';
import { ErrorState } from '../components/ErrorState';
import { parseBondSearch, toBondParameters, toSearchParams, type BondSearchState } from '../lib/bondSearchParams';
import { formatNumber } from '../lib/format';

const SCOPE_TABS: { value: BondScope; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'local', label: 'Рублёвые' },
  { value: 'foreign', label: 'Валютные' },
];

export function BondsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseBondSearch(searchParams), [searchParams]);
  const parameters = useMemo(() => toBondParameters(state), [state]);

  // бэк считает страницы с 0, таблица - с 1
  const query = useBondsPage(state.scope, state.page - 1, state.size, parameters);

  const update = (patch: Partial<BondSearchState>, { resetPage = true } = {}) => {
    // новый фильтр или сортировка возвращают на первую страницу
    setSearchParams(toSearchParams({ ...state, ...(resetPage ? { page: 1 } : {}), ...patch }));
  };

  const reset = () =>
    update({
      priceMin: undefined,
      priceMax: undefined,
      percentMin: undefined,
      percentMax: undefined,
      riskLevels: [],
      ofz: 'any',
    });

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Title order={2}>Облигации</Title>
        {query.data && (
          <Text c="dimmed" size="sm">
            Найдено: {formatNumber(query.data.totalElements)}
          </Text>
        )}
      </Group>

      <Tabs value={state.scope} onChange={(scope) => scope && update({ scope: scope as BondScope })}>
        <Tabs.List>
          {SCOPE_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <BondFilters state={state} onChange={update} onReset={reset} />

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <BondsTable data={query.data} fetching={query.isFetching} state={state} onChange={update} />
      )}
    </Stack>
  );
}
