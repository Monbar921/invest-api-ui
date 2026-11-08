import { Alert as MantineAlert, Group, Loader, Stack, Switch, Text } from '@mantine/core';
import { useState } from 'react';
import { MAX_ALERT_DAYS } from '../api/alerts';
import { useAlertMutations, useAlerts, useTelegramStatus } from '../api/queries';
import type { Alert, AlertType } from '../api/types';
import { ALERT_TYPES } from '../lib/alerts';
import { plural } from '../lib/format';
import { DebouncedNumberInput } from './DebouncedNumberInput';

/**
 * Правила уведомлений одной облигации: по строке на тип события - включить и за сколько дней предупредить.
 * Выключение не удаляет правило: дни сохраняются, его можно включить обратно (так же работает кнопка в Telegram).
 */
export function BondAlertsPanel({ ticker }: { ticker: string }) {
  const alerts = useAlerts();
  const { create, update } = useAlertMutations();
  const error = create.error ?? update.error;

  if (alerts.isPending) {
    return (
      <Group justify="center" py="sm">
        <Loader size="sm" />
      </Group>
    );
  }

  if (alerts.isError) {
    return (
      <Text size="sm" c="red">
        Не удалось загрузить уведомления: {alerts.error.message}
      </Text>
    );
  }

  const byType = new Map(alerts.data.filter((alert) => alert.ticker === ticker).map((alert) => [alert.type, alert]));

  return (
    <Stack gap="sm">
      {ALERT_TYPES.map((item) => (
        <AlertRow
          key={item.type}
          type={item.type}
          label={item.label}
          hint={item.hint}
          defaultDays={item.defaultDays}
          alert={byType.get(item.type)}
          onEnable={(days) => {
            const existing = byType.get(item.type);
            if (existing) {
              update.mutate({ id: existing.id, enabled: true, days });
            } else {
              create.mutate({ ticker, type: item.type, days });
            }
          }}
          onDisable={(id) => update.mutate({ id, enabled: false })}
          onDays={(id, days) => update.mutate({ id, days })}
        />
      ))}
      {error && (
        <Text size="xs" c="red">
          {error.message}
        </Text>
      )}
    </Stack>
  );
}

function AlertRow({
  type,
  label,
  hint,
  defaultDays,
  alert,
  onEnable,
  onDisable,
  onDays,
}: {
  type: AlertType;
  label: string;
  hint: string;
  defaultDays: number;
  alert: Alert | undefined;
  onEnable: (days: number) => void;
  onDisable: (id: number) => void;
  onDays: (id: number, days: number) => void;
}) {
  // дни, пока правила нет: их и отправим при включении
  const [draftDays, setDraftDays] = useState(defaultDays);
  const days = alert?.days ?? draftDays;
  const enabled = alert?.enabled ?? false;

  return (
    <Group justify="space-between" wrap="nowrap" align="center" data-alert-type={type}>
      <Switch
        checked={enabled}
        onChange={(event) => (event.currentTarget.checked ? onEnable(days) : alert && onDisable(alert.id))}
        label={label}
        description={hint}
        aria-label={label}
      />
      <Group gap={6} wrap="nowrap">
        <Text size="sm" c="dimmed">
          за
        </Text>
        <DebouncedNumberInput
          value={days}
          onChange={(value) => {
            if (value == null || value < 1 || value > MAX_ALERT_DAYS) {
              return;
            }
            if (alert) {
              onDays(alert.id, value);
            } else {
              setDraftDays(value);
            }
          }}
          min={1}
          max={MAX_ALERT_DAYS}
          allowDecimal={false}
          w={70}
          size="xs"
          aria-label={`${label}: за сколько дней`}
        />
        <Text size="sm" c="dimmed" w={30}>
          {plural(days, 'день', 'дня', 'дней')}
        </Text>
      </Group>
    </Group>
  );
}

/** Предупреждение, если уведомлениям некуда приходить */
export function TelegramRequiredHint() {
  const status = useTelegramStatus(true, false);
  if (!status.data || (status.data.enabled && status.data.linked)) {
    return null;
  }
  return (
    <MantineAlert color="yellow" p="xs">
      <Text size="xs">
        {status.data.enabled
          ? 'Telegram не подключён - уведомления не придут. Подключите его кнопкой Telegram в шапке.'
          : 'Бот уведомлений выключен на сервере - уведомления не придут.'}
      </Text>
    </MantineAlert>
  );
}
