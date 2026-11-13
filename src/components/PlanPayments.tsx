import { Alert, Anchor, Badge, Button, Checkbox, Group, Loader, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { IconCreditCard, IconRefresh } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { usePaymentMutations, usePayments, usePaymentStatus } from '../api/queries';
import type { AccountPlan, Payment, PaymentStatus, Plan } from '../api/types';
import { trackGoal } from '../lib/analytics';
import { formatDate, formatDateTime } from '../lib/format';
import { formatPrice, planPrice } from '../lib/plans';
import { ApiErrorText } from './ApiErrorText';

/**
 * Покупка тарифа: условия, согласие с офертой и политикой персональных данных, переход на страницу оплаты Т-Кассы.
 * Тот же тариф со сроком продлевается от последнего дня, другой - заменяет текущий с сегодняшнего дня.
 */
export function PurchaseModal({ plan, account, onClose }: { plan: Plan | null; account: AccountPlan; onClose: () => void }) {
  const { purchase } = usePaymentMutations();
  const [agreed, setAgreed] = useState(false);
  const { offerUrl, privacyUrl } = account.payments;
  const sameActive = plan != null && !account.defaultPlan && account.plan.id === plan.id;
  const replacesOther = plan != null && !account.defaultPlan && account.plan.id !== plan.id;

  const close = () => {
    setAgreed(false);
    purchase.reset();
    onClose();
  };

  const pay = () => {
    if (!plan) {
      return;
    }
    purchase.mutate(plan.id, {
      onSuccess: (payment) => {
        if (payment.confirmationUrl) {
          trackGoal('plan_checkout_started');
          window.location.assign(payment.confirmationUrl);
        }
      },
    });
  };

  return (
    <Modal opened={plan != null} onClose={close} title={plan ? `Тариф «${plan.title}»` : ''}>
      {plan && (
        <Stack gap="md">
          <Text fw={500}>{planPrice(plan)}</Text>
          {sameActive && account.validUntil && (
            <Text size="sm">
              Срок продлится: к последнему дню {formatDate(account.validUntil)} добавится {plan.periodTitle}.
            </Text>
          )}
          {replacesOther && (
            <Text size="sm" c="orange">
              Тариф «{account.plan.title}» будет заменён, новый срок начнётся сегодня. Оставшиеся дни не переносятся.
            </Text>
          )}
          <Text size="sm" c="dimmed">
            Оплата картой на странице Т-Банка. Карта сохранится для автопродления: за день до конца срока спишем{' '}
            {formatPrice(plan.price)}. Автопродление можно отключить на этой странице в любой момент.
          </Text>
          <Checkbox
            checked={agreed}
            onChange={(event) => setAgreed(event.currentTarget.checked)}
            label={
              <>
                Принимаю условия{' '}
                <Anchor href={offerUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                  оферты
                </Anchor>{' '}
                и{' '}
                <Anchor href={privacyUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                  политики обработки персональных данных
                </Anchor>
              </>
            }
          />
          {purchase.isError && <ApiErrorText error={purchase.error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Отмена
            </Button>
            <Button leftSection={<IconCreditCard size={16} />} disabled={!agreed} loading={purchase.isPending} onClick={pay}>
              Перейти к оплате
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

/**
 * Итог оплаты после возврата со страницы Т-Кассы (?payment=id): пока платёж ждёт подтверждения, статус опрашивается.
 */
export function PaymentResult({ id, onClose }: { id: number; onClose: () => void }) {
  const payment = usePaymentStatus(id);
  const tracked = useRef(false);
  const succeeded = payment.data?.status === 'SUCCEEDED';

  useEffect(() => {
    if (succeeded && !tracked.current) {
      tracked.current = true;
      trackGoal('plan_paid');
    }
  }, [succeeded]);

  if (payment.isPending) {
    return null;
  }
  if (payment.isError) {
    return (
      <Alert color="red" withCloseButton onClose={onClose} title="Не удалось узнать статус оплаты">
        <ApiErrorText error={payment.error} />
      </Alert>
    );
  }
  const { status, planTitle, errorMessage } = payment.data;
  if (status === 'PENDING') {
    return (
      <Alert color="blue" withCloseButton onClose={onClose} title="Ждём подтверждение оплаты" icon={<Loader size="xs" />}>
        Если деньги списались, тариф «{planTitle}» включится автоматически - обычно в течение минуты. Можно закрыть эту страницу.
      </Alert>
    );
  }
  if (status === 'SUCCEEDED') {
    return (
      <Alert color="teal" withCloseButton onClose={onClose} title="Оплата прошла">
        Тариф «{planTitle}» подключён.
      </Alert>
    );
  }
  return (
    <Alert color="red" withCloseButton onClose={onClose} title="Оплата не прошла">
      {errorMessage ? `${errorMessage}. ` : ''}Тариф не изменился, деньги не списаны. Можно попробовать ещё раз.
    </Alert>
  );
}

/** Автопродление: когда и сколько спишется, отключение с подтверждением */
export function AutoRenewalInfo({ account }: { account: AccountPlan }) {
  const { cancelAutoRenewal } = usePaymentMutations();
  const [confirming, setConfirming] = useState(false);
  const renewal = account.payments.autoRenewal;

  if (!renewal) {
    return account.source === 'PAYMENT' && account.validUntil ? (
      <Text size="sm" c="dimmed">
        Автопродление выключено - после {formatDate(account.validUntil)} будет тариф по умолчанию. Данные сохранятся.
      </Text>
    ) : null;
  }

  return (
    <Stack gap={6}>
      <Group gap={6} wrap="nowrap">
        <IconRefresh size={16} color="var(--mantine-color-teal-6)" />
        <Text size="sm">
          Автопродление: {renewal.amount != null ? `${formatPrice(renewal.amount)} спишется ` : 'списание '}
          {formatDate(renewal.nextChargeDate)}
          {renewal.cardPan ? ` с карты ${maskedCard(renewal.cardPan)}` : ''}.
        </Text>
      </Group>
      <Group>
        <Button size="xs" variant="subtle" color="red" onClick={() => setConfirming(true)}>
          Отключить автопродление
        </Button>
      </Group>
      <Modal opened={confirming} onClose={() => setConfirming(false)} title="Отключить автопродление?">
        <Stack gap="md">
          <Text size="sm">
            Тариф «{renewal.planTitle}» будет действовать до конца оплаченного срока
            {account.validUntil ? ` - по ${formatDate(account.validUntil)} включительно` : ''}, дальше - тариф по умолчанию. Новых
            списаний не будет.
          </Text>
          {cancelAutoRenewal.isError && <ApiErrorText error={cancelAutoRenewal.error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirming(false)}>
              Оставить
            </Button>
            <Button
              color="red"
              loading={cancelAutoRenewal.isPending}
              onClick={() => cancelAutoRenewal.mutate(undefined, { onSuccess: () => setConfirming(false) })}
            >
              Отключить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

const STATUS_LABELS: Record<PaymentStatus, { label: string; color: string }> = {
  PENDING: { label: 'ждёт оплаты', color: 'blue' },
  SUCCEEDED: { label: 'оплачен', color: 'teal' },
  FAILED: { label: 'не прошёл', color: 'red' },
  REFUNDED: { label: 'возвращён', color: 'gray' },
};

/** История платежей: квитанции покупок и автопродлений */
export function PaymentsHistory() {
  const payments = usePayments(true);

  if (!payments.data?.length) {
    return null;
  }
  return (
    <Stack gap="sm">
      <Title order={4}>История платежей</Title>
      <Table.ScrollContainer minWidth={560}>
        <Table withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Дата</Table.Th>
              <Table.Th>Тариф</Table.Th>
              <Table.Th>Сумма</Table.Th>
              <Table.Th>Карта</Table.Th>
              <Table.Th>Статус</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {payments.data.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}

function PaymentRow({ payment }: { payment: Payment }) {
  const status = STATUS_LABELS[payment.status];
  return (
    <Table.Tr>
      <Table.Td>{formatDateTime(payment.paidAt ?? payment.createdAt)}</Table.Td>
      <Table.Td>
        {payment.planTitle}, {payment.periodTitle}
        {payment.kind === 'RENEWAL' && (
          <Text span size="xs" c="dimmed">
            {' '}
            (автопродление)
          </Text>
        )}
      </Table.Td>
      <Table.Td>{formatPrice(payment.amount)}</Table.Td>
      <Table.Td>{payment.cardPan ? maskedCard(payment.cardPan) : '-'}</Table.Td>
      <Table.Td>
        <Group gap={6} wrap="nowrap">
          <Badge size="sm" variant="light" color={status.color} title={payment.errorMessage ?? undefined}>
            {status.label}
          </Badge>
          {payment.confirmationUrl && (
            <Anchor href={payment.confirmationUrl} size="sm">
              Оплатить
            </Anchor>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

/** «430000******0777» → «•••• 0777» */
function maskedCard(pan: string): string {
  return `•••• ${pan.slice(-4)}`;
}
