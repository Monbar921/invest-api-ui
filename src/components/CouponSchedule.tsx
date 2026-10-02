import { BarChart } from '@mantine/charts';
import { Card, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { Coupon, CouponPayment } from '../api/types';
import { formatDate, formatMoney, formatNumber } from '../lib/format';

interface Props {
  coupon: Coupon | null;
  now?: Date;
}

export function CouponSchedule({ coupon, now = new Date() }: Props) {
  const payments = coupon?.couponData ?? [];

  if (payments.length === 0) {
    return (
      <Card withBorder padding="md">
        <Title order={4}>График выплат</Title>
        <Text c="dimmed" size="sm" mt="xs">
          {coupon ? 'График выплат ещё не загружен' : 'Данных о купонах нет'}
        </Text>
      </Card>
    );
  }

  const upcoming = payments.filter((payment) => isUpcoming(payment, now));
  const next = upcoming[0];
  const upcomingTotal = sumInOneCurrency(upcoming);

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Title order={4}>График выплат</Title>
          <Stack gap={0} align="flex-end">
            {next ? (
              <Text size="sm">
                Ближайшая: <b>{formatMoney(next.price)}</b> {formatDate(next.paymentDate)}
              </Text>
            ) : (
              <Text size="sm" c="dimmed">
                Все выплаты прошли
              </Text>
            )}
            {upcoming.length > 0 && (
              <Text size="xs" c="dimmed">
                Осталось {formatNumber(upcoming.length)}
                {upcomingTotal && ` на ${formatMoney(upcomingTotal)}`}
              </Text>
            )}
          </Stack>
        </Group>

        {upcoming.length > 1 && (
          <BarChart
            h={220}
            data={upcoming.map((payment) => ({
              date: formatDate(payment.paymentDate),
              amount: payment.price?.quantity ?? 0,
            }))}
            dataKey="date"
            series={[{ name: 'amount', label: 'Выплата', color: 'blue.6' }]}
            valueFormatter={(value) => formatMoney({ quantity: value, currency: next?.price?.currency ?? null })}
            tickLine="y"
          />
        )}

        <Table.ScrollContainer minWidth={420} maxHeight={400}>
          <Table striped highlightOnHover stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>№</Table.Th>
                <Table.Th>Дата фиксации</Table.Th>
                <Table.Th>Дата выплаты</Table.Th>
                <Table.Th ta="right">Сумма</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {payments.map((payment, index) => (
                <Table.Tr key={`${payment.paymentDate}-${index}`} c={isUpcoming(payment, now) ? undefined : 'dimmed'}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>{formatDate(payment.fixDate)}</Table.Td>
                  <Table.Td>{formatDate(payment.paymentDate)}</Table.Td>
                  <Table.Td ta="right">{formatMoney(payment.price)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Card>
  );
}

function isUpcoming(payment: CouponPayment, now: Date): boolean {
  return payment.paymentDate != null && new Date(payment.paymentDate).getTime() >= startOfDay(now).getTime();
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Сумма выплат, если все они в одной валюте и с известной суммой; иначе складывать нельзя */
function sumInOneCurrency(payments: CouponPayment[]) {
  const currencies = new Set(payments.map((payment) => payment.price?.currency));
  if (currencies.size !== 1 || payments.some((payment) => payment.price?.quantity == null)) {
    return null;
  }

  return {
    quantity: payments.reduce((sum, payment) => sum + (payment.price?.quantity ?? 0), 0),
    currency: payments[0]?.price?.currency ?? null,
  };
}
