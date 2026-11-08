import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  NumberInput,
  Popover,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { fetchBond } from '../api/bonds';
import { MAX_BUY_PRICE, MAX_POSITION_QUANTITY } from '../api/portfolio';
import { bondKeys, usePortfolio, usePortfolioMutations } from '../api/queries';
import type { PortfolioPosition, PortfolioTotal } from '../api/types';
import { BondSearch } from '../components/BondSearch';
import { BrokerSelect } from '../components/BrokerSelect';
import { ErrorState } from '../components/ErrorState';
import { isIsoDate, todayIso } from '../lib/dates';
import { formatChange, formatDate, formatMoney, formatNumber, formatPercent } from '../lib/format';

/** «Портфель»: покупки облигаций, их текущая стоимость и доход от цены покупки */
export function PortfolioPage() {
  const portfolio = usePortfolio();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PortfolioPosition | null>(null);

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Портфель</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding(true)}>
          Добавить покупку
        </Button>
      </Group>

      {portfolio.isPending && <Loader size="sm" />}
      {portfolio.isError && <ErrorState error={portfolio.error} onRetry={() => void portfolio.refetch()} />}
      {portfolio.data && portfolio.data.positions.length === 0 && (
        <Text c="dimmed">В портфеле пока ничего нет. Добавьте покупку: облигацию, количество, цену и дату.</Text>
      )}
      {portfolio.data && portfolio.data.positions.length > 0 && (
        <>
          <Totals totals={portfolio.data.totals} />
          <PositionsTable positions={portfolio.data.positions} onEdit={setEditing} />
          <Text size="xs" c="dimmed">
            Доход - только от изменения цены: (текущая цена − цена покупки) × номинал × количество. Купоны, НКД и комиссии не
            учитываются.
          </Text>
        </>
      )}

      <Modal opened={adding} onClose={() => setAdding(false)} title="Новая покупка">
        {adding && <PositionForm onDone={() => setAdding(false)} />}
      </Modal>
      <Modal
        opened={editing != null}
        onClose={() => setEditing(null)}
        title={editing ? `Покупка: ${editing.bondName ?? editing.ticker}` : ''}
      >
        {editing && <PositionForm position={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </Stack>
  );
}

/** Цвет дохода: прибыль зелёная, убыток красный */
function revenueColor(value: number | null): string | undefined {
  if (value == null || value === 0) {
    return undefined;
  }
  return value > 0 ? 'teal' : 'red';
}

function money(value: number | null, currency: string | null): string {
  return formatMoney({ quantity: value, currency });
}

function signedMoney(value: number | null, currency: string | null): string {
  if (value == null) {
    return '—';
  }
  const formatted = money(Math.abs(value), currency);
  if (value > 0) {
    return `+${formatted}`;
  }
  return value < 0 ? `−${formatted}` : formatted;
}

function signedPercent(value: number | null): string {
  return value == null ? '—' : `${formatChange(value)} %`;
}

/** Итоги по валютам: суммы в разных валютах не складываются */
function Totals({ totals }: { totals: PortfolioTotal[] }) {
  if (totals.length === 0) {
    return null;
  }
  return (
    <SimpleGrid cols={{ base: 1, sm: Math.min(totals.length, 3) }}>
      {totals.map((total) => (
        <Card key={total.currency} withBorder padding="md">
          <Text size="sm" c="dimmed">
            Стоимость, {total.currency.toUpperCase()}
          </Text>
          <Text fw={600} size="xl">
            {money(total.currentAmount, total.currency)}
          </Text>
          <Text size="sm" c="dimmed">
            куплено на {money(total.buyAmount, total.currency)}
          </Text>
          <Text fw={500} c={revenueColor(total.revenue)} mt={4}>
            {signedMoney(total.revenue, total.currency)} ({signedPercent(total.revenuePercent)})
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function PositionsTable({
  positions,
  onEdit,
}: {
  positions: PortfolioPosition[];
  onEdit: (position: PortfolioPosition) => void;
}) {
  return (
    <Card withBorder padding={0}>
      <Table.ScrollContainer minWidth={1000}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Облигация</Table.Th>
              <Table.Th>Брокер</Table.Th>
              <Table.Th>Дата покупки</Table.Th>
              <Table.Th ta="right">Кол-во</Table.Th>
              <Table.Th ta="right">Цена покупки</Table.Th>
              <Table.Th ta="right">Текущая цена</Table.Th>
              <Table.Th ta="right">Стоимость</Table.Th>
              <Table.Th ta="right">Доход</Table.Th>
              <Table.Th ta="right">Доход, %</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {positions.map((position) => (
              <PositionRow key={position.id} position={position} onEdit={() => onEdit(position)} />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

function PositionRow({ position, onEdit }: { position: PortfolioPosition; onEdit: () => void }) {
  const { remove } = usePortfolioMutations();
  const [confirming, setConfirming] = useState(false);
  const name = position.bondName ?? position.ticker;

  return (
    <Table.Tr>
      <Table.Td>
        {position.bondName ? (
          <Anchor component={Link} to={`/bonds/${encodeURIComponent(position.ticker)}`} size="sm" fw={500}>
            {position.bondName}
          </Anchor>
        ) : (
          <Text size="sm" fw={500}>
            {position.ticker}
          </Text>
        )}
        <Text size="xs" c="dimmed">
          {position.bondName ? position.ticker : 'облигации больше нет в списке торгуемых'}
        </Text>
      </Table.Td>
      <Table.Td>
        {position.broker ?? (
          <Text size="sm" c="dimmed">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td>{formatDate(position.buyDate)}</Table.Td>
      <Table.Td ta="right">{formatNumber(position.quantity)}</Table.Td>
      <Table.Td ta="right">{formatPercent(position.buyPrice)}</Table.Td>
      <Table.Td ta="right">{formatPercent(position.currentPrice)}</Table.Td>
      <Table.Td ta="right">
        <Text size="sm">{money(position.currentAmount, position.currency)}</Text>
        <Text size="xs" c="dimmed">
          куплено на {money(position.buyAmount, position.currency)}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={500} c={revenueColor(position.revenue)}>
          {signedMoney(position.revenue, position.currency)}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={500} c={revenueColor(position.revenuePercent)}>
          {signedPercent(position.revenuePercent)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap={4} wrap="nowrap" justify="flex-end">
          <Tooltip label="Изменить">
            <ActionIcon variant="subtle" color="gray" aria-label={`Изменить покупку: ${name}`} onClick={onEdit}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Popover opened={confirming} onChange={setConfirming} position="bottom-end" withArrow shadow="md">
            <Popover.Target>
              <Tooltip label="Удалить" disabled={confirming}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Удалить покупку: ${name}`}
                  onClick={() => setConfirming((value) => !value)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown>
              <Stack gap="xs">
                <Text size="sm">Удалить покупку {name}?</Text>
                <Group gap="xs" justify="flex-end">
                  <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
                    Отмена
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    loading={remove.isPending}
                    onClick={() => remove.mutate(position.id, { onSuccess: () => setConfirming(false) })}
                  >
                    Удалить
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

/**
 * Новая покупка или изменение существующей. У новой цена покупки по умолчанию - текущая цена выбранной облигации,
 * пока пользователь не ввёл свою. Облигацию у существующей покупки не поменять - только удалить и добавить заново.
 */
function PositionForm({ position, onDone }: { position?: PortfolioPosition; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { create, update } = usePortfolioMutations();
  const today = todayIso();
  const [ticker, setTicker] = useState<string | null>(position?.ticker ?? null);
  const [tickerName, setTickerName] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number | undefined>(position?.quantity ?? 1);
  const [buyPrice, setBuyPrice] = useState<number | undefined>(position?.buyPrice);
  // пользователь ввёл свою цену - текущая цена облигации её не затирает, даже если пришла позже
  const priceTouched = useRef(position != null);
  const [buyDate, setBuyDate] = useState(position?.buyDate ?? today);
  const [broker, setBroker] = useState<string | null>(position?.broker ?? null);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    ticker: position == null && !ticker ? 'Выберите облигацию' : undefined,
    quantity:
      quantity == null || quantity < 1 || quantity > MAX_POSITION_QUANTITY
        ? `От 1 до ${formatNumber(MAX_POSITION_QUANTITY)}`
        : undefined,
    buyPrice: buyPrice == null || buyPrice <= 0 || buyPrice > MAX_BUY_PRICE ? `Больше 0 и не выше ${MAX_BUY_PRICE} %` : undefined,
    buyDate: !isIsoDate(buyDate) ? 'Укажите дату' : buyDate > today ? 'Не позже сегодня' : undefined,
  };
  const valid = Object.values(errors).every((error) => error == null);
  const mutation = position ? update : create;

  const onTickerChange = (next: string | null) => {
    setTicker(next);
    setTickerName(null);
    if (!next) {
      return;
    }
    void queryClient
      .fetchQuery({ queryKey: bondKeys.detail(next), queryFn: () => fetchBond(next) })
      .then((bond) => {
        setTickerName(bond.name);
        const current = bond.price?.percentagePrice;
        if (current != null) {
          setBuyPrice((value) => (priceTouched.current ? value : current));
        }
      })
      .catch(() => undefined);
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid || quantity == null || buyPrice == null) {
      return;
    }
    // пустая строка - без брокера (в том числе снять брокера у существующей покупки)
    const request = { quantity, buyPrice, buyDate, broker: broker ?? '' };
    if (position) {
      update.mutate({ id: position.id, ...request }, { onSuccess: onDone });
    } else {
      create.mutate({ ticker: ticker!, ...request }, { onSuccess: onDone });
    }
  };

  const shown = (error: string | undefined) => (submitted ? error : undefined);

  return (
    <Stack gap="md">
      {position ? (
        <Text size="sm" c="dimmed">
          {position.ticker}
        </Text>
      ) : (
        <div>
          <BondSearch value={ticker} selectedName={tickerName} onChange={onTickerChange} />
          {shown(errors.ticker) && (
            <Text size="xs" c="red" mt={4}>
              {errors.ticker}
            </Text>
          )}
        </div>
      )}
      <NumberInput
        label="Количество, шт."
        value={quantity ?? ''}
        onChange={(value) => setQuantity(typeof value === 'number' ? value : undefined)}
        min={1}
        max={MAX_POSITION_QUANTITY}
        allowDecimal={false}
        thousandSeparator=" "
        error={shown(errors.quantity)}
      />
      <NumberInput
        label="Цена покупки, % номинала"
        value={buyPrice ?? ''}
        onChange={(value) => {
          priceTouched.current = true;
          setBuyPrice(typeof value === 'number' ? value : undefined);
        }}
        min={0}
        decimalScale={4}
        decimalSeparator=","
        error={shown(errors.buyPrice)}
      />
      <BrokerSelect value={broker} onChange={setBroker} />
      <TextInput
        label="Дата покупки"
        type="date"
        value={buyDate}
        max={today}
        onChange={(event) => setBuyDate(event.currentTarget.value)}
        error={shown(errors.buyDate)}
      />
      {mutation.isError && (
        <Text size="sm" c="red">
          {mutation.error.message}
        </Text>
      )}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Отмена
        </Button>
        <Button onClick={submit} loading={mutation.isPending}>
          {position ? 'Сохранить' : 'Добавить'}
        </Button>
      </Group>
    </Stack>
  );
}
