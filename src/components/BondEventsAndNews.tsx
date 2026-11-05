import { Badge, Button, Card, Group, Loader, Stack, Table, Tabs, Text } from '@mantine/core';
import { IconCalendarEvent, IconNews } from '@tabler/icons-react';
import { useState } from 'react';
import { useBondEvents, useBondNews } from '../api/queries';
import type { BondEvent, BondEventType } from '../api/types';
import { formatDate, formatMoney } from '../lib/format';
import { ErrorState } from './ErrorState';
import { NewsList } from './NewsList';

const EVENT_TYPES: Record<BondEventType, { label: string; color: string }> = {
  COUPON: { label: 'Купон', color: 'blue' },
  AMORTIZATION: { label: 'Амортизация', color: 'orange' },
  OFFER: { label: 'Оферта', color: 'grape' },
  MATURITY: { label: 'Погашение', color: 'teal' },
};

// у долгих выпусков купонов на годы вперёд - сначала ближайшие
const UPCOMING_LIMIT = 8;

interface Props {
  ticker: string;
  now?: Date;
}

/**
 * События по бумаге и новости - на разных вкладках: события считаются из графика выплат и дат выпуска,
 * новости приходят от Мосбиржи, рейтинговых агентств и СМИ.
 */
export function BondEventsAndNews({ ticker, now = new Date() }: Props) {
  return (
    <Card withBorder padding="md">
      <Tabs defaultValue="events" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="events" leftSection={<IconCalendarEvent size={16} />}>
            События по бумаге
          </Tabs.Tab>
          <Tabs.Tab value="news" leftSection={<IconNews size={16} />}>
            Новости
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="events">
          <BondEvents ticker={ticker} now={now} />
        </Tabs.Panel>
        <Tabs.Panel value="news">
          <BondNews ticker={ticker} />
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}

function BondEvents({ ticker, now }: { ticker: string; now: Date }) {
  const query = useBondEvents(ticker);
  const [showAll, setShowAll] = useState(false);

  if (query.isPending) {
    return <CenteredLoader />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const today = toIsoDate(now);
  const past = query.data.filter((event) => event.date < today);
  const upcoming = query.data.filter((event) => event.date >= today);
  const shownUpcoming = showAll ? upcoming : upcoming.slice(0, UPCOMING_LIMIT);

  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Из графика купонов и амортизации, дат оферты и погашения - за последние 3 месяца и вперёд
      </Text>
      {query.data.length === 0 ? (
        <Text size="sm" c="dimmed">
          Событий нет: график выплат ещё не загружен
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={360}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Дата</Table.Th>
                <Table.Th>Событие</Table.Th>
                <Table.Th ta="right">На одну облигацию</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {[...past, ...shownUpcoming].map((event, index) => (
                <EventRow key={`${event.type}-${event.date}-${index}`} event={event} past={event.date < today} />
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {upcoming.length > UPCOMING_LIMIT && (
        <Group>
          <Button variant="subtle" size="xs" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Только ближайшие' : `Все будущие (${upcoming.length})`}
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function EventRow({ event, past }: { event: BondEvent; past: boolean }) {
  const type = EVENT_TYPES[event.type] ?? { label: event.type, color: 'gray' };

  return (
    <Table.Tr c={past ? 'dimmed' : undefined}>
      <Table.Td>{formatDate(event.date)}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <Badge size="sm" variant={past ? 'outline' : 'light'} color={type.color}>
            {type.label}
          </Badge>
          {event.previousAmount && event.amount?.quantity != null && event.previousAmount.quantity != null && (
            <Text size="xs" c={event.amount.quantity > event.previousAmount.quantity ? 'teal' : 'red'}>
              {event.amount.quantity > event.previousAmount.quantity ? 'вырос' : 'снизился'}, был{' '}
              {formatMoney(event.previousAmount)}
            </Text>
          )}
        </Group>
      </Table.Td>
      <Table.Td ta="right">{amountText(event)}</Table.Td>
    </Table.Tr>
  );
}

function amountText(event: BondEvent): string {
  if (event.amount) {
    return formatMoney(event.amount);
  }
  if (event.type === 'COUPON') {
    return 'не объявлен';
  }
  // у оферты выплаты нет, у погашения амортизируемой облигации остаток номинала - в строке амортизации
  return '—';
}

function BondNews({ ticker }: { ticker: string }) {
  const query = useBondNews(ticker);

  if (query.isPending) {
    return <CenteredLoader />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  return (
    <Stack gap="sm">
      <Text size="xs" c="dimmed">
        Где упомянут выпуск или его эмитент: Мосбиржа, рейтинговые агентства АКРА и НКР, СМИ
      </Text>
      <NewsList
        items={query.data.pages.flatMap((page) => page.content)}
        hasMore={query.hasNextPage}
        loadingMore={query.isFetchingNextPage}
        onLoadMore={() => query.fetchNextPage()}
        emptyText="Новостей по этой облигации и её эмитенту пока нет"
      />
    </Stack>
  );
}

function CenteredLoader() {
  return (
    <Group justify="center" py="md">
      <Loader size="sm" />
    </Group>
  );
}

/** YYYY-MM-DD по местному времени - как даты событий, без часового пояса */
function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
