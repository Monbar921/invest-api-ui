import { Anchor, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../api/client';
import { useIssuer, useIssuerNews } from '../api/queries';
import type { Issuer } from '../api/types';
import { FixedOrderBondsTable } from '../components/BondsTable';
import { ErrorState } from '../components/ErrorState';
import { NewsList } from '../components/NewsList';
import { usePageMeta } from '../lib/seo';
import { NotFoundPage } from './NotFoundPage';

/** Страница эмитента: название, ИНН, выпуски из системы и новости */
export function IssuerPage() {
  const { id = '' } = useParams();
  const issuerId = /^\d+$/.test(id) ? Number(id) : NaN;
  const query = useIssuer(issuerId);
  usePageMeta(query.data ? issuerMeta(query.data) : null);

  if (Number.isNaN(issuerId) || (query.error instanceof ApiError && query.error.status === 404)) {
    return <NotFoundPage message="Эмитент не найден" />;
  }

  if (query.isPending) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return <IssuerDetails issuer={query.data} />;
}

function issuerName(issuer: Pick<Issuer, 'id' | 'title' | 'shortTitle'>): string {
  return issuer.shortTitle ?? issuer.title ?? `Эмитент ${issuer.id}`;
}

function issuerMeta(issuer: Issuer) {
  const name = issuerName(issuer);
  return {
    title: `${name} - облигации эмитента`,
    description:
      `Облигации эмитента ${name}${issuer.inn ? ` (ИНН ${issuer.inn})` : ''}: выпусков в обращении - ` +
      `${issuer.bonds.length}. Цены, доходности к погашению, даты погашения и новости эмитента.`,
    canonicalPath: `/issuers/${issuer.id}`,
  };
}

function IssuerDetails({ issuer }: { issuer: Issuer }) {
  const name = issuerName(issuer);
  const news = useIssuerNews(issuer.id);
  const newsItems = news.data?.pages.flatMap((page) => page.content) ?? [];

  return (
    <Stack gap="lg">
      <Anchor component={Link} to="/bonds" size="sm">
        <Group gap={4}>
          <IconArrowLeft size={14} />
          Все облигации
        </Group>
      </Anchor>

      <Stack gap={4}>
        <Title order={2}>{name}</Title>
        {issuer.title && issuer.title !== name && <Text c="dimmed">{issuer.title}</Text>}
        {issuer.inn && <Text size="sm">ИНН {issuer.inn}</Text>}
      </Stack>

      <Stack gap="xs">
        <Title order={4}>Выпуски</Title>
        <FixedOrderBondsTable bonds={issuer.bonds} emptyText="Выпусков в обращении нет" />
      </Stack>

      <Card withBorder>
        <Stack gap="sm">
          <Title order={4}>Новости эмитента</Title>
          {news.isPending ? (
            <Loader size="sm" />
          ) : news.isError ? (
            <ErrorState error={news.error} onRetry={() => news.refetch()} />
          ) : (
            <NewsList
              items={newsItems}
              hasMore={news.hasNextPage}
              loadingMore={news.isFetchingNextPage}
              onLoadMore={() => news.fetchNextPage()}
              emptyText="Новостей об эмитенте пока нет"
            />
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
