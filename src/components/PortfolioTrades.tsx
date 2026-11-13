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
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePortfolioTrades, useSaleMutations } from '../api/queries';
import type { PortfolioTrade, PortfolioTradeType } from '../api/types';
import { formatDate, formatNumber, formatPercent } from '../lib/format';
import { money } from '../lib/money';
import { ApiErrorText } from './ApiErrorText';
import { ErrorState } from './ErrorState';
import { SaleForm } from './SaleForm';

const TYPE_LABELS: Record<PortfolioTradeType, { label: string; color: string }> = {
  BUY: { label: 'Покупка', color: 'blue' },
  SALE: { label: 'Продажа', color: 'orange' },
  REDEMPTION: { label: 'Погашение', color: 'teal' },
};

/**
 * Вкладка «Сделки»: покупки, продажи и погашения, новые первыми. Продажи меняются и удаляются здесь, покупки - на
 * вкладке «Покупки». Погашение не вводится - оно следует из даты погашения облигации.
 */
export function PortfolioTrades() {
  const trades = usePortfolioTrades();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PortfolioTrade | null>(null);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Продажа закрывает самые ранние покупки (FIFO). Погашение учитывается само в дату погашения.
        </Text>
        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          Добавить продажу
        </Button>
      </Group>
      {trades.isPending && <Loader size="sm" />}
      {trades.isError && <ErrorState error={trades.error} onRetry={() => void trades.refetch()} />}
      {trades.data && trades.data.length === 0 && <Text c="dimmed">Сделок пока нет.</Text>}
      {trades.data && trades.data.length > 0 && (
        <Card withBorder padding={0}>
          <Table.ScrollContainer minWidth={980}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Дата</Table.Th>
                  <Table.Th>Сделка</Table.Th>
                  <Table.Th>Облигация</Table.Th>
                  <Table.Th ta="right">Кол-во</Table.Th>
                  <Table.Th ta="right">Цена</Table.Th>
                  <Table.Th ta="right">Сумма</Table.Th>
                  <Table.Th ta="right">НКД</Table.Th>
                  <Table.Th ta="right">Комиссия</Table.Th>
                  <Table.Th>Брокер</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {trades.data.map((trade) => (
                  <TradeRow key={`${trade.type}-${trade.id ?? trade.ticker}`} trade={trade} onEdit={() => setEditing(trade)} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      <Modal opened={adding} onClose={() => setAdding(false)} title="Новая продажа">
        {adding && <SaleForm onDone={() => setAdding(false)} />}
      </Modal>
      <Modal
        opened={editing != null}
        onClose={() => setEditing(null)}
        title={editing ? `Продажа: ${editing.bondName ?? editing.ticker}` : ''}
      >
        {editing && <SaleForm sale={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Stack>
  );
}

function TradeRow({ trade, onEdit }: { trade: PortfolioTrade; onEdit: () => void }) {
  const type = TYPE_LABELS[trade.type];
  return (
    <Table.Tr>
      <Table.Td>{formatDate(trade.date)}</Table.Td>
      <Table.Td>
        <Badge variant="light" color={type.color}>
          {type.label}
        </Badge>
      </Table.Td>
      <Table.Td>
        {trade.bondName ? (
          <Anchor component={Link} to={`/bonds/${encodeURIComponent(trade.ticker)}`} size="sm">
            {trade.bondName}
          </Anchor>
        ) : (
          <Text size="sm">{trade.ticker}</Text>
        )}
      </Table.Td>
      <Table.Td ta="right">{formatNumber(trade.quantity)}</Table.Td>
      <Table.Td ta="right">{formatPercent(trade.price)}</Table.Td>
      <Table.Td ta="right">{money(trade.amount, trade.currency)}</Table.Td>
      <Table.Td ta="right">
        <Text size="sm">{money(trade.aci, trade.currency)}</Text>
        {trade.aciCalculated && trade.aci != null && (
          <Text size="xs" c="dimmed">
            по графику
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">{trade.commission == null ? '—' : money(trade.commission, trade.currency)}</Table.Td>
      <Table.Td>{trade.broker ?? '—'}</Table.Td>
      <Table.Td>
        {trade.type === 'SALE' && trade.id != null && <SaleActions trade={trade} id={trade.id} onEdit={onEdit} />}
      </Table.Td>
    </Table.Tr>
  );
}

function SaleActions({ trade, id, onEdit }: { trade: PortfolioTrade; id: number; onEdit: () => void }) {
  const { remove } = useSaleMutations();
  const [confirming, setConfirming] = useState(false);
  const label = `${trade.bondName ?? trade.ticker} от ${formatDate(trade.date)}`;

  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Tooltip label="Изменить">
        <ActionIcon variant="subtle" color="gray" aria-label={`Изменить продажу: ${label}`} onClick={onEdit}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
      <Popover opened={confirming} onChange={setConfirming} position="bottom-end" withArrow shadow="md">
        <Popover.Target>
          <Tooltip label="Удалить" disabled={confirming}>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Удалить продажу: ${label}`}
              onClick={() => setConfirming((value) => !value)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <Text size="sm">Удалить продажу {label}?</Text>
            {remove.isError && <ApiErrorText error={remove.error} />}
            <Group gap="xs" justify="flex-end">
              <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
                Отмена
              </Button>
              <Button
                size="xs"
                color="red"
                loading={remove.isPending}
                onClick={() => remove.mutate(id, { onSuccess: () => setConfirming(false) })}
              >
                Удалить
              </Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}
