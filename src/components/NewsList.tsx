import { Anchor, Badge, Button, Divider, Group, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { Fragment } from 'react';
import { Link } from 'react-router';
import type { NewsItem, NewsSource } from '../api/types';
import { formatDateTime } from '../lib/format';

const NEWS_SOURCES: Record<NewsSource, { label: string; color: string }> = {
  CBR_PRESS: { label: 'Банк России', color: 'blue' },
  CBR_EVENT: { label: 'Банк России', color: 'blue' },
  MOEX: { label: 'Мосбиржа', color: 'grape' },
};

interface Props {
  items: NewsItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyText: string;
}

/** Список внешних новостей: источник, время, заголовок со ссылкой на источник, облигации и эмитенты */
export function NewsList({ items, hasMore, loadingMore, onLoadMore, emptyText }: Props) {
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {emptyText}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {items.map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 && <Divider />}
          <NewsEntry item={item} />
        </Fragment>
      ))}
      {hasMore && (
        <Button variant="subtle" size="xs" onClick={onLoadMore} loading={loadingMore}>
          Показать ещё
        </Button>
      )}
    </Stack>
  );
}

function NewsEntry({ item }: { item: NewsItem }) {
  const source = NEWS_SOURCES[item.source] ?? { label: item.source, color: 'gray' };
  const bonds = item.bonds ?? [];
  const issuers = item.issuers ?? [];

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap">
        <Badge size="xs" variant="light" color={source.color}>
          {source.label}
        </Badge>
        <Text size="xs" c="dimmed">
          {formatDateTime(item.publishedAt)}
        </Text>
      </Group>
      {item.url ? (
        // текст новостей не перепечатываем - читать у источника
        <Anchor href={item.url} target="_blank" rel="noopener noreferrer" size="sm" c="inherit" fw={500}>
          {item.title}
          <IconExternalLink size={12} style={{ marginLeft: 4, verticalAlign: 'middle' }} aria-hidden />
        </Anchor>
      ) : (
        <Text size="sm" fw={500}>
          {item.title}
        </Text>
      )}
      {item.summary && (
        <Text size="xs" c="dimmed" lineClamp={3}>
          {item.summary}
        </Text>
      )}
      {(bonds.length > 0 || issuers.length > 0) && (
        <Group gap={4}>
          {bonds.map((bond) => (
            <Badge
              key={bond.ticker}
              component={Link}
              to={`/bonds/${encodeURIComponent(bond.ticker)}`}
              size="xs"
              variant="outline"
              style={{ cursor: 'pointer', textTransform: 'none' }}
              title={bond.name ?? bond.ticker}
            >
              {bond.name ?? bond.ticker}
            </Badge>
          ))}
          {issuers.map((issuer) => (
            <Badge key={issuer} size="xs" variant="default" style={{ textTransform: 'none' }}>
              {issuer}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  );
}
