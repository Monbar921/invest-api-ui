import { Card, Divider, Group, Loader, SegmentedControl, Stack, Title } from '@mantine/core';
import { useState } from 'react';
import { useNewsFeed } from '../api/queries';
import type { NewsSource } from '../api/types';
import { ErrorState } from './ErrorState';
import { MarketOverviewCard } from './MarketOverviewCard';
import { NewsList } from './NewsList';

type SourceFilter = 'all' | 'cbr' | 'moex' | 'ratings' | 'media';

// подписи короткие: пять вариантов в узкой колонке
const FILTERS: { value: SourceFilter; label: string; sources: NewsSource[] }[] = [
  { value: 'all', label: 'Все', sources: [] },
  { value: 'cbr', label: 'ЦБ', sources: ['CBR_PRESS', 'CBR_EVENT'] },
  { value: 'moex', label: 'Биржа', sources: ['MOEX'] },
  { value: 'ratings', label: 'Рейтинги', sources: ['ACRA', 'NKR'] },
  {
    value: 'media',
    label: 'СМИ',
    sources: ['INTERFAX', 'RBC', 'KOMMERSANT', 'VEDOMOSTI', 'FINAM', 'FRANK_MEDIA', 'SMART_LAB'],
  },
];

/** Лента финансовых новостей на главной: ставка и курсы ЦБ сверху, ниже новости ЦБ, Мосбиржи, рейтинговых агентств и СМИ */
export function NewsFeed() {
  const [filter, setFilter] = useState<SourceFilter>('all');
  const sources = FILTERS.find((item) => item.value === filter)!.sources;
  const query = useNewsFeed(sources);
  const items = query.data?.pages.flatMap((page) => page.content) ?? [];

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <MarketOverviewCard />
        <Divider />
        <Group justify="space-between" align="center">
          <Title order={4}>Новости</Title>
          {query.isFetching && !query.isFetchingNextPage && <Loader size="xs" />}
        </Group>
        <SegmentedControl
          size="xs"
          fullWidth
          aria-label="Источник новостей"
          data={FILTERS.map(({ value, label }) => ({ value, label }))}
          value={filter}
          onChange={(value) => setFilter(value as SourceFilter)}
        />
        {query.isPending ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <NewsList
            items={items}
            hasMore={query.hasNextPage}
            loadingMore={query.isFetchingNextPage}
            onLoadMore={() => query.fetchNextPage()}
            emptyText="Новостей пока нет: они загружаются раз в 15 минут"
          />
        )}
      </Stack>
    </Card>
  );
}
