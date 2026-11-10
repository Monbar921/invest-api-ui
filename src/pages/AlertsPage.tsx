import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Popover,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconSettings, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAlertMutations, useAlerts, useNotifications } from '../api/queries';
import type { Alert } from '../api/types';
import { BondAlertsPanel, EventSwitch, TelegramRequiredHint } from '../components/BondAlertsPanel';
import { useSession } from '../api/session';
import { ErrorState } from '../components/ErrorState';
import { LoginRequired } from '../components/LoginRequired';
import { describeAlert, KEY_RATE_ALERT, NOTIFICATION_STATUSES } from '../lib/alerts';
import { formatDateTime } from '../lib/format';

/** «Уведомления»: правила по облигациям и история отправленного */
export function AlertsPage() {
  const { authenticated } = useSession();
  if (!authenticated) {
    return (
      <LoginRequired
        title="Уведомления"
        text="Войдите, чтобы получать в Telegram уведомления о купонах, офертах, погашениях, цене облигаций и решениях Банка России по ключевой ставке."
      />
    );
  }
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

/**
 * Облигация с правилами - кратко, текстом; настройка - в том же окне, что у колокольчика. Удаление всех правил
 * облигации - только после подтверждения: кнопка рядом с соседними карточками, промахнуться легко.
 */
function BondCard({ ticker, alerts }: { ticker: string; alerts: Alert[] }) {
  const { remove } = useAlertMutations();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const name = alerts[0]?.bondName;
  const sorted = [...alerts].sort((a, b) => a.id - b.id);

  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
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
          <Group gap={4} wrap="nowrap">
            <Button size="xs" variant="light" leftSection={<IconSettings size={14} />} onClick={() => setEditing(true)}>
              Настроить
            </Button>
            <Popover opened={confirming} onChange={setConfirming} position="bottom-end" withArrow shadow="md">
              <Popover.Target>
                <Tooltip label="Удалить уведомления по облигации" disabled={confirming}>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Удалить уведомления: ${ticker}`}
                    onClick={() => setConfirming((value) => !value)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  <Text size="sm">Удалить все уведомления по {name ?? ticker}?</Text>
                  <Group gap="xs" justify="flex-end">
                    <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
                      Отмена
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      loading={remove.isPending}
                      onClick={() => {
                        alerts.forEach((alert) => remove.mutate(alert.id));
                        setConfirming(false);
                      }}
                    >
                      Удалить
                    </Button>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Group>
        <Group gap={6}>
          {sorted.map((alert) => (
            <Badge key={alert.id} variant={alert.enabled ? 'light' : 'outline'} color={alert.enabled ? undefined : 'gray'}>
              {describeAlert(alert)}
              {alert.enabled ? '' : ' (выкл.)'}
            </Badge>
          ))}
        </Group>
      </Stack>
      <Modal opened={editing} onClose={() => setEditing(false)} title={`Уведомления: ${name ?? ticker}`}>
        {editing && <BondAlertsPanel ticker={ticker} />}
      </Modal>
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
