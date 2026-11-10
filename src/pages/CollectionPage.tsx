import { Anchor, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { useCollection } from '../api/queries';
import { FixedOrderBondsTable } from '../components/BondsTable';
import { ErrorState } from '../components/ErrorState';
import { usePageMeta } from '../lib/seo';
import { NotFoundPage } from './NotFoundPage';

const PAGE_SIZE = 50;

/** Подборка облигаций на готовом фильтре: фильтр и порядок задаёт бэк, страница - в ?page= */
export function CollectionPage() {
  const { slug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const query = useCollection(slug, page - 1, PAGE_SIZE);
  const collection = query.data;

  usePageMeta(
    collection
      ? { title: collection.title, description: collection.description, canonicalPath: `/collections/${collection.slug}` }
      : null,
  );

  if (query.error instanceof ApiError && query.error.status === 404) {
    return <NotFoundPage message="Такой подборки нет" />;
  }

  if (query.isPending) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (query.isError || !collection) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/bonds" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} />
          Все облигации
        </Group>
      </Anchor>
      <Stack gap={4}>
        <Title order={2}>{collection.title}</Title>
        <Text c="dimmed" maw={900}>
          {collection.description}
        </Text>
      </Stack>
      <FixedOrderBondsTable
        bonds={collection.bonds.content}
        fetching={query.isFetching}
        emptyText="Сейчас в подборке нет облигаций"
        pagination={{
          page,
          size: PAGE_SIZE,
          total: collection.bonds.totalElements,
          onPageChange: (next) => setSearchParams(next > 1 ? { page: String(next) } : {}),
        }}
      />
    </Stack>
  );
}
