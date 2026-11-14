import { Anchor, Box, Grid, Group, Stack, Tabs, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useBondsPage, useCollections } from '../api/queries';
import type { BondParameters, BondScope } from '../api/types';
import { BondExportButton } from '../components/BondExportButton';
import { BondFilters } from '../components/BondFilters';
import { BondSearch } from '../components/BondSearch';
import { BondsTable } from '../components/BondsTable';
import { ErrorState } from '../components/ErrorState';
import { NewsFeed } from '../components/NewsFeed';
import { trackGoal } from '../lib/analytics';
import { EMPTY_FILTERS, parseBondSearch, toBondParameters, toSearchParams, type BondSearchState } from '../lib/bondSearchParams';
import { formatNumber } from '../lib/format';
import { usePageMeta } from '../lib/seo';

const SCOPE_TABS: { value: BondScope; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'local', label: 'Рублёвые' },
  { value: 'foreign', label: 'Валютные' },
];

export function BondsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useMemo(() => parseBondSearch(searchParams), [searchParams]);
  const parameters = useMemo(() => toBondParameters(state), [state]);
  // выборка в query-строке - та же страница: canonical без параметров
  usePageMeta({
    title: 'Облигации Мосбиржи: цены, доходность, купоны',
    description:
      'Список облигаций: ОФЗ, корпоративные и валютные выпуски. Фильтры по цене, риску, рейтингу, дюрации, спреду к ОФЗ ' +
      'и ликвидности, сортировка по доходности к погашению и к оферте, лента новостей ЦБ и Мосбиржи.',
    canonicalPath: '/bonds',
  });

  // бэк считает страницы с 0, таблица - с 1
  const query = useBondsPage(state.scope, state.page - 1, state.size, parameters);

  const update = (patch: Partial<BondSearchState>, { resetPage = true } = {}) => {
    // новый фильтр или сортировка возвращают на первую страницу
    setSearchParams(toSearchParams({ ...state, ...(resetPage ? { page: 1 } : {}), ...patch }));
  };

  const reset = () => update(EMPTY_FILTERS);

  return (
    // лента слева; на узком экране она уходит под таблицу - облигации остаются первыми
    // 24 колонки: ленте - меньше четверти ширины, на широком экране ещё уже
    <Grid gap="md" columns={24}>
      <Grid.Col span={{ base: 24, lg: 7, xl: 6 }} order={{ base: 2, lg: 1 }}>
        <NewsFeed />
      </Grid.Col>
      <Grid.Col span={{ base: 24, lg: 17, xl: 18 }} order={{ base: 1, lg: 2 }}>
        <BondsList
          state={state}
          parameters={parameters}
          query={query}
          update={update}
          reset={reset}
          onSelect={(ticker) => navigate(`/bonds/${encodeURIComponent(ticker)}`)}
        />
      </Grid.Col>
    </Grid>
  );
}

interface BondsListProps {
  state: BondSearchState;
  parameters: BondParameters;
  query: ReturnType<typeof useBondsPage>;
  update: (patch: Partial<BondSearchState>, options?: { resetPage?: boolean }) => void;
  reset: () => void;
  onSelect: (ticker: string) => void;
}

function BondsList({ state, parameters, query, update, reset, onSelect }: BondsListProps) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Title order={2}>Облигации</Title>
        <Group gap="sm">
          {query.data && (
            <Text c="dimmed" size="sm">
              Найдено: {formatNumber(query.data.totalElements)}
            </Text>
          )}
          <BondExportButton scope={state.scope} parameters={parameters} />
        </Group>
      </Group>

      <CollectionLinks />

      {/* поиск по всем облигациям, а не по текущей выборке: выбранная открывается в карточке */}
      <Box maw={560}>
        <BondSearch label="Поиск облигации" value={null} onChange={(ticker) => ticker && onSelect(ticker)} />
      </Box>

      <Tabs value={state.scope} onChange={(scope) => scope && update({ scope: scope as BondScope })}>
        <Tabs.List>
          {SCOPE_TABS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <BondFilters
        state={state}
        onChange={(patch) => {
          // какие фильтры трогают - имена полей, без значений
          trackGoal('bond_filter', { filter: Object.keys(patch) });
          update(patch);
        }}
        onReset={reset}
      />

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <BondsTable data={query.data} fetching={query.isFetching} state={state} onChange={update} />
      )}
    </Stack>
  );
}

/** Подборки на готовых фильтрах - отдельные страницы с постоянным адресом */
function CollectionLinks() {
  const { data } = useCollections();
  if (!data?.length) {
    return null;
  }
  return (
    <Group gap="xs">
      <Text size="sm" c="dimmed">
        Подборки:
      </Text>
      {data.map((collection) => (
        <Anchor key={collection.slug} component={Link} to={`/collections/${collection.slug}`} size="sm">
          {collection.title}
        </Anchor>
      ))}
    </Group>
  );
}
