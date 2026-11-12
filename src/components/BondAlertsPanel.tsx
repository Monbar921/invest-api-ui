import {
  ActionIcon,
  Alert as MantineAlert,
  Button,
  Divider,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { MAX_ALERT_DAYS } from '../api/alerts';
import { useAlertMutations, useAlerts, useBond, useTelegramStatus } from '../api/queries';
import type { Alert, AlertDirection, AlertType, Bond, PriceAlertType } from '../api/types';
import { ALERT_TYPES, describePriceAlert, EVENT_ALERT_TYPES, isDateAlert, isPriceAlert, PRICE_ALERT_TYPES } from '../lib/alerts';
import { formatPercent, plural } from '../lib/format';
import { DECIMAL_SEPARATORS } from '../lib/numbers';
import { ApiErrorText } from './ApiErrorText';
import { DebouncedNumberInput } from './DebouncedNumberInput';

/**
 * Правила уведомлений одной облигации: по строке на тип события - включить и за сколько дней предупредить.
 * Выключение не удаляет правило: дни сохраняются, его можно включить обратно (так же работает кнопка в Telegram).
 */
export function BondAlertsPanel({ ticker }: { ticker: string }) {
  const alerts = useAlerts();
  const bond = useBond(ticker);
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

  const bondAlerts = alerts.data.filter((alert) => alert.ticker === ticker);
  const byType = new Map(bondAlerts.filter((alert) => isDateAlert(alert.type)).map((alert) => [alert.type, alert]));
  // «Объявлен купон» - только для купона, который объявляют по одному (флоатер); пока облигация грузится - показываем
  const eventTypes = EVENT_ALERT_TYPES.filter(
    (item) =>
      item.type !== 'FLOATER_COUPON' ||
      bond.data?.coupon?.isFixed !== true ||
      bondAlerts.some((alert) => alert.type === item.type),
  );

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Даты выплат
      </Text>
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
      {error && <ApiErrorText error={error} size="xs" />}
      <Divider />
      <Text size="sm" fw={600}>
        События и новости
      </Text>
      {eventTypes.map((item) => (
        <EventSwitch
          key={item.type}
          label={item.label}
          hint={item.hint}
          alert={bondAlerts.find((alert) => alert.type === item.type)}
          onCreate={() => create.mutate({ ticker, type: item.type })}
        />
      ))}
      <Divider />
      <PriceAlerts ticker={ticker} bond={bond.data} alerts={bondAlerts.filter((alert) => isPriceAlert(alert.type))} />
    </Stack>
  );
}

/** Текущее значение, с которым сравнивается уровень: цена в % от номинала или доходность */
function currentValue(type: PriceAlertType, bond: Bond | undefined): number | null {
  switch (type) {
    case 'PRICE_LEVEL':
      return bond?.price?.percentagePrice ?? null;
    case 'YTM_LEVEL':
      return bond?.coupon?.yieldToMaturity ?? null;
    case 'YTO_LEVEL':
      return bond?.coupon?.yieldToOffer ?? null;
    default:
      return null;
  }
}

/**
 * Пороги по цене и доходности: их может быть несколько на облигацию (например, «выше 101%» и «ниже 95%»).
 * Сработавший уровень снова взводится, когда значение вернётся за порог; изменение от текущей цены - разовое.
 */
function PriceAlerts({ ticker, bond, alerts }: { ticker: string; bond: Bond | undefined; alerts: Alert[] }) {
  const { create, update, remove } = useAlertMutations();
  // доходность к оферте - только если оферта есть; пока облигация грузится - показываем все
  const types = PRICE_ALERT_TYPES.filter(
    (item) => item.type !== 'YTO_LEVEL' || bond == null || bond.offerDate != null || bond.coupon?.yieldToOffer != null,
  );
  const [type, setType] = useState<PriceAlertType>('PRICE_LEVEL');
  const config = types.find((item) => item.type === type) ?? types[0]!;
  const [direction, setDirection] = useState<AlertDirection>(config.defaultDirection);
  const [threshold, setThreshold] = useState<number | string>(config.defaultThreshold);
  const error = create.error ?? update.error ?? remove.error;

  const changeType = (next: PriceAlertType) => {
    const nextConfig = types.find((item) => item.type === next) ?? types[0]!;
    setType(next);
    setDirection(nextConfig.defaultDirection);
    setThreshold(nextConfig.defaultThreshold);
  };
  const value = typeof threshold === 'number' ? threshold : Number.parseFloat(threshold.replace(',', '.'));
  const valid = Number.isFinite(value) && value >= config.min && value <= config.max;
  const current = currentValue(config.type, bond);
  // уровень уже пересечён - правило сработает сразу после добавления
  const alreadyMet =
    valid && current != null && (direction === 'UP' ? current >= value : direction === 'DOWN' && current <= value);
  // порядок не прыгает после включения и выключения: как добавлены
  const sorted = [...alerts].sort((a, b) => a.id - b.id);

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Цена и доходность
      </Text>
      {bond && (
        <Text size="xs" c="dimmed">
          Сейчас: цена {formatPercent(bond.price?.percentagePrice)} номинала, к погашению{' '}
          {formatPercent(bond.coupon?.yieldToMaturity)}
          {bond.coupon?.yieldToOffer != null && `, к оферте ${formatPercent(bond.coupon.yieldToOffer)}`}
        </Text>
      )}
      {sorted.map((alert) => (
        <Group key={alert.id} justify="space-between" wrap="nowrap" gap="xs">
          <Switch
            checked={alert.enabled}
            onChange={(event) => update.mutate({ id: alert.id, enabled: event.currentTarget.checked })}
            label={describePriceAlert(alert)}
            description={alert.enabled && alert.state === 'TRIGGERED' ? 'сработало, ждёт возврата за порог' : undefined}
            aria-label={describePriceAlert(alert)}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Удалить: ${describePriceAlert(alert)}`}
            onClick={() => remove.mutate(alert.id)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      ))}
      <Group gap="xs" align="flex-start" wrap="wrap">
        <Select
          label="Уведомить, когда"
          data={types.map((item) => ({ value: item.type, label: item.label }))}
          value={config.type}
          onChange={(next) => next && changeType(next as PriceAlertType)}
          allowDeselect={false}
          size="xs"
          w={210}
        />
        <Select
          label="Направление"
          data={config.directions}
          value={direction}
          onChange={(next) => next && setDirection(next as AlertDirection)}
          allowDeselect={false}
          size="xs"
          w={150}
        />
        <NumberInput
          label="Порог, %"
          value={threshold}
          onChange={setThreshold}
          // без подрезки: 500 не должно молча превращаться в 300 - показываем ошибку
          clampBehavior="none"
          decimalSeparator=","
          allowedDecimalSeparators={DECIMAL_SEPARATORS}
          error={valid ? undefined : `от ${config.min} до ${config.max}`}
          size="xs"
          w={110}
        />
        <Button
          size="xs"
          mt={22}
          disabled={!valid}
          loading={create.isPending}
          onClick={() => valid && create.mutate({ ticker, type: config.type, direction, threshold: value })}
        >
          Добавить
        </Button>
      </Group>
      <Text size="xs" c={alreadyMet ? 'orange' : 'dimmed'}>
        {alreadyMet
          ? 'Условие уже выполнено - уведомление придёт сразу после добавления.'
          : `${config.unit === '%' ? 'в процентах от цены' : config.unit}, от ${config.min} до ${config.max}`}
      </Text>
      {error && <ApiErrorText error={error} size="xs" />}
    </Stack>
  );
}

/**
 * Правило по событию без параметров: включить - создать (или включить заново), выключить - выключить, не удалить.
 * Уведомляет только о новом - о том, что появится после включения.
 */
export function EventSwitch({
  label,
  hint,
  alert,
  onCreate,
}: {
  label: string;
  hint: string;
  alert: Alert | undefined;
  onCreate: () => void;
}) {
  const { update } = useAlertMutations();
  return (
    <Switch
      checked={alert?.enabled ?? false}
      onChange={(event) => {
        if (alert) {
          update.mutate({ id: alert.id, enabled: event.currentTarget.checked });
        } else if (event.currentTarget.checked) {
          onCreate();
        }
      }}
      label={label}
      description={hint}
      aria-label={label}
    />
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
