import { ActionIcon, Anchor, Badge, Button, Card, Group, Loader, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useAlertMutations, useAlerts, useNotifications } from '../api/queries';
import type { Alert } from '../api/types';
import { BondAlertsPanel, EventSwitch, TelegramRequiredHint } from '../components/BondAlertsPanel';
import { ErrorState } from '../components/ErrorState';
import { KEY_RATE_ALERT, NOTIFICATION_STATUSES } from '../lib/alerts';
import { formatDateTime } from '../lib/format';

/** «Уведомления»: правила по облигациям и история отправленного */
export function AlertsPage() {
  return (
    <Stack gap="lg">
      <Title order={2}>Уведомления</Title>
      <TelegramRequiredHint />
      <CentralBankCard />
      <AlertsByBond />
      <History />
    </Stack>
  );
}

/** Правила без облигации: решения ЦБ по ключевой ставке */
function CentralBankCard() {
  const alerts = useAlerts();
  const { create } = useAlertMutations();
  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Text fw={500}>Банк России</Text>
        <EventSwitch
          label={KEY_RATE_ALERT.label}
          hint={KEY_RATE_ALERT.hint}
          alert={alerts.data?.find((alert) => alert.type === 'KEY_RATE')}
          onCreate={() => create.mutate({ type: 'KEY_RATE' })}
        />
      </Stack>
    </Card>
  );
}

function AlertsByBond() {
  const alerts = useAlerts();

  if (alerts.isPending) {
    return <Loader size="sm" />;
  }
  if (alerts.isError) {
    return <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />;
  }
  if (alerts.data.every((alert) => alert.ticker == null)) {
    return <Text c="dimmed">Уведомлений пока нет. Включите их колокольчиком у облигации в таблице или в её карточке.</Text>;
  }

  // по облигации - в порядке тикеров, как отдаёт бэк
  const bonds = new Map<string, Alert[]>();
  for (const alert of alerts.data) {
    // правило без облигации (ключевая ставка) - в карточке «Банк России»
    if (alert.ticker == null) {
      continue;
    }
    bonds.set(alert.ticker, [...(bonds.get(alert.ticker) ?? []), alert]);
  }

  return (
    <Stack gap="md">
      {[...bonds.entries()].map(([ticker, bondAlerts]) => (
        <BondCard key={ticker} ticker={ticker} alerts={bondAlerts} />
      ))}
    </Stack>
  );
}

function BondCard({ ticker, alerts }: { ticker: string; alerts: Alert[] }) {
  const { remove } = useAlertMutations();
  const name = alerts[0]?.bondName;

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <div>
            {name ? (
              <Anchor component={Link} to={`/bonds/${encodeURIComponent(ticker)}`} fw={500}>
                {name}
              </Anchor>
            ) : (
              <Text fw={500}>{ticker}</Text>
            )}
            <Text size="xs" c="dimmed">
              {name ? ticker : 'облигации больше нет в списке торгуемых'}
            </Text>
          </div>
          <Tooltip label="Удалить уведомления по облигации">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Удалить уведомления: ${ticker}`}
              loading={remove.isPending}
              onClick={() => alerts.forEach((alert) => remove.mutate(alert.id))}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <BondAlertsPanel ticker={ticker} />
      </Stack>
    </Card>
  );
}

function History() {
  const history = useNotifications();

  return (
    <Stack gap="sm">
      <Title order={4}>История</Title>
      {history.isPending && <Loader size="sm" />}
      {history.isError && <ErrorState error={history.error} onRetry={() => void history.refetch()} />}
      {history.data && history.data.pages[0]?.content.length === 0 && (
        <Text c="dimmed" size="sm">
          Уведомлений ещё не было.
        </Text>
      )}
      {history.data?.pages.flatMap((page) =>
        page.content.map((item) => {
          const status = NOTIFICATION_STATUSES[item.status];
          return (
            <Card key={item.id} withBorder padding="sm">
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">
                  {formatDateTime(item.sentAt ?? item.createdAt)}
                </Text>
                <Badge color={status.color} variant="light" size="sm">
                  {status.label}
                </Badge>
              </Group>
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                {item.text}
              </Text>
              {item.lastError && item.status !== 'SENT' && (
                <Text size="xs" c={item.status === 'FAILED' ? 'red' : 'dimmed'} mt={4}>
                  {item.lastError}
                </Text>
              )}
            </Card>
          );
        }),
      )}
      {history.hasNextPage && (
        <Button variant="default" onClick={() => void history.fetchNextPage()} loading={history.isFetchingNextPage}>
          Показать ещё
        </Button>
      )}
    </Stack>
  );
}
