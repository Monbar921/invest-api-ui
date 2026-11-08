import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Popover,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { fetchBond } from '../api/bonds';
import { MAX_BUY_PRICE, MAX_POSITION_QUANTITY } from '../api/portfolio';
import { bondKeys, usePortfolio, usePortfolioMutations } from '../api/queries';
import type { PortfolioGroup, PortfolioPosition, PortfolioPositionRequest, PortfolioSummary, PortfolioTotal } from '../api/types';
import { BondSearch } from '../components/BondSearch';
import { BrokerSelect } from '../components/BrokerSelect';
import { ErrorState } from '../components/ErrorState';
import { NumberField } from '../components/NumberField';
import { isIsoDate, todayIso } from '../lib/dates';
import { formatChange, formatDate, formatMoney, formatNumber, formatPercent, isRubCurrency, plural } from '../lib/format';

/** Облигация, выбранная заранее: «+» в строке облигации открывает новую покупку уже с ней */
interface PresetBond {
  ticker: string;
  name: string | null;
  currency: string | null;
  currentPrice: number | null;
}

/** «Портфель»: покупки облигаций - строкой на облигацию, их текущая стоимость и доход от цены покупки */
export function PortfolioPage() {
  const portfolio = usePortfolio();
  const [adding, setAdding] = useState<{ bond?: PresetBond } | null>(null);
  const [editing, setEditing] = useState<PortfolioPosition | null>(null);
  const groups = portfolio.data?.groups ?? [];

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Портфель</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setAdding({})}>
          Добавить покупку
        </Button>
      </Group>

      {portfolio.isPending && <Loader size="sm" />}
      {portfolio.isError && <ErrorState error={portfolio.error} onRetry={() => void portfolio.refetch()} />}
      {portfolio.data && groups.length === 0 && (
        <Text c="dimmed">В портфеле пока ничего нет. Добавьте покупку: облигацию, количество, цену и дату.</Text>
      )}
      {portfolio.data && groups.length > 0 && (
        <>
          <Totals totals={portfolio.data.totals} summary={portfolio.data.summary} />
          <PositionsTable
            groups={groups}
            onEdit={setEditing}
            onAdd={(group) =>
              setAdding({
                bond: {
                  ticker: group.ticker,
                  name: group.bondName,
                  currency: group.currency,
                  currentPrice: group.currentPrice,
                },
              })
            }
          />
          <Text size="xs" c="dimmed">
            Доход - только от изменения цены: (текущая цена − цена покупки) × номинал × количество. Купоны, НКД и комиссии не
            учитываются. Доход в рублях - от суммы, заплаченной в рублях (не указана - по курсу ЦБ на дату покупки), до стоимости
            по сегодняшнему курсу.
          </Text>
        </>
      )}

      <Modal opened={adding != null} onClose={() => setAdding(null)} title="Новая покупка">
        {adding && <PositionForm preset={adding.bond} onDone={() => setAdding(null)} />}
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

/**
 * Подпись в рублях под суммой в валюте; у рублёвых покупок и без курса её нет - вторая строка с тем же числом
 * или прочерком ничего не добавляет
 */
function RubCaption({ value, currency, signed = false }: { value: number | null; currency: string | null; signed?: boolean }) {
  if (value == null || isRubCurrency(currency)) {
    return null;
  }
  return (
    <Text size="xs" c="dimmed">
      {signed ? signedMoney(value, 'rub') : money(value, 'rub')}
    </Text>
  );
}

function signedPercent(value: number | null): string {
  return value == null ? '—' : `${formatChange(value)} %`;
}

/**
 * Итоги: первым - весь портфель в рублях, дальше по валютам (суммы в разных валютах не складываются). Карточки
 * «Всего» нет, если у какой-то валюты нет курса: без неё сумма выдавала бы себя за весь портфель.
 */
function Totals({ totals, summary }: { totals: PortfolioTotal[]; summary: PortfolioSummary | null }) {
  if (totals.length === 0) {
    return null;
  }
  const cards = totals.length + (summary ? 1 : 0);
  return (
    <SimpleGrid cols={{ base: 1, sm: Math.min(cards, 3) }}>
      {summary && (
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            Всего, в рублях
          </Text>
          <Text fw={600} size="xl">
            {money(summary.currentAmountInRub, 'rub')}
          </Text>
          <Text size="xs" c="dimmed">
            все валюты по сегодняшнему курсу
          </Text>
          <Text fw={500} c={revenueColor(summary.revenueInRub)} mt={4}>
            {signedMoney(summary.revenueInRub, 'rub')} ({signedPercent(summary.revenuePercent)})
          </Text>
        </Card>
      )}
      {totals.map((total) => (
        <Card key={total.currency} withBorder padding="md">
          <Text size="sm" c="dimmed">
            Стоимость, {total.currency.toUpperCase()}
          </Text>
          <Text fw={600} size="xl">
            {money(total.currentAmount, total.currency)}
          </Text>
          <RubCaption value={total.currentAmountInRub} currency={total.currency} />
          <Text fw={500} c={revenueColor(total.revenue)} mt={4}>
            {signedMoney(total.revenue, total.currency)} ({signedPercent(total.revenuePercent)})
          </Text>
          <RubCaption value={total.revenueInRub} currency={total.currency} signed />
        </Card>
      ))}
    </SimpleGrid>
  );
}

function PositionsTable({
  groups,
  onEdit,
  onAdd,
}: {
  groups: PortfolioGroup[];
  onEdit: (position: PortfolioPosition) => void;
  onAdd: (group: PortfolioGroup) => void;
}) {
  return (
    <Card withBorder padding={0}>
      <Table.ScrollContainer minWidth={1250}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Облигация</Table.Th>
              <Table.Th>Брокер</Table.Th>
              <Table.Th>Дата покупки</Table.Th>
              <Table.Th ta="right">Кол-во</Table.Th>
              <Table.Th ta="right">
                <Tooltip label="У облигации - средняя по покупкам, взвешенная по количеству">
                  <span style={{ cursor: 'help' }}>Цена покупки</span>
                </Tooltip>
              </Table.Th>
              <Table.Th ta="right">Текущая цена</Table.Th>
              <Table.Th ta="right">
                <Tooltip label="Купон, % годовых от номинала">
                  <span style={{ cursor: 'help' }}>Купон</span>
                </Tooltip>
              </Table.Th>
              <Table.Th ta="right">
                <Tooltip
                  label="Доходность к погашению по цене покупки: как если бы купить сегодня по ней (с сегодняшним НКД). Ниже - по текущей цене"
                  multiline
                  w={300}
                >
                  <span style={{ cursor: 'help' }}>К погашению</span>
                </Tooltip>
              </Table.Th>
              <Table.Th ta="right">Стоимость</Table.Th>
              <Table.Th ta="right">Доход</Table.Th>
              <Table.Th ta="right">Доход, %</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groups.map((group) => (
              <GroupRows key={group.ticker} group={group} onEdit={onEdit} onAdd={() => onAdd(group)} />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

/** Брокеры строки облигации: один - по имени, несколько - числом, имена в подсказке */
function BrokersCell({ brokers }: { brokers: string[] }) {
  if (brokers.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        —
      </Text>
    );
  }
  if (brokers.length === 1) {
    return <Text size="sm">{brokers[0]}</Text>;
  }
  return (
    <Tooltip label={brokers.join(', ')}>
      <Text size="sm" style={{ cursor: 'help' }}>
        {brokers.length} {plural(brokers.length, 'брокер', 'брокера', 'брокеров')}
      </Text>
    </Tooltip>
  );
}

function datesLabel(first: string, last: string): string {
  return first === last ? formatDate(first) : `${formatDate(first)} – ${formatDate(last)}`;
}

// ширина стрелки и кнопки действия: пустые места того же размера держат имена и кнопки ровными колонками
const TOGGLE_WIDTH = 22;
const ACTION_WIDTH = 28;
const ACTION_GAP = 4;

/**
 * Облигация одной строкой. Одна покупка - строка и есть покупка: «изменить» / «удалить» прямо в ней, раскрывать
 * нечего. Несколько - свод с суммами и средней ценой, стрелка раскрывает покупки. У всех строк «+» (ещё покупка этой
 * облигации) на одном месте, а на месте стрелки и чужих кнопок - пустое место той же ширины: колонки ровные.
 */
function GroupRows({
  group,
  onEdit,
  onAdd,
}: {
  group: PortfolioGroup;
  onEdit: (position: PortfolioPosition) => void;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = group.bondName ?? group.ticker;
  const toggleLabel = `${expanded ? 'Скрыть' : 'Показать'} покупки: ${name}`;
  const single = group.positions.length === 1 ? group.positions[0]! : null;

  return (
    <>
      <Table.Tr>
        <Table.Td>
          <Group gap={6} wrap="nowrap" align="flex-start">
            {single ? (
              <Box w={TOGGLE_WIDTH} style={{ flex: 'none' }} />
            ) : (
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label={toggleLabel} onClick={() => setExpanded((v) => !v)}>
                {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </ActionIcon>
            )}
            <div>
              {group.bondName ? (
                <Anchor component={Link} to={`/bonds/${encodeURIComponent(group.ticker)}`} size="sm" fw={500}>
                  {group.bondName}
                </Anchor>
              ) : (
                <Text size="sm" fw={500}>
                  {group.ticker}
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {group.bondName ? group.ticker : 'облигации больше нет в списке торгуемых'}
                {single == null &&
                  ` · ${group.positions.length} ${plural(group.positions.length, 'покупка', 'покупки', 'покупок')}`}
              </Text>
            </div>
          </Group>
        </Table.Td>
        <Table.Td>
          <BrokersCell brokers={group.brokers} />
        </Table.Td>
        <Table.Td>{datesLabel(group.firstBuyDate, group.lastBuyDate)}</Table.Td>
        <Table.Td ta="right">{formatNumber(group.quantity)}</Table.Td>
        <Table.Td ta="right">
          <Text size="sm">{formatPercent(group.buyPrice)}</Text>
          {single && <PaidRubCaption position={single} />}
        </Table.Td>
        <Table.Td ta="right">{formatPercent(group.currentPrice)}</Table.Td>
        <Table.Td ta="right">{formatPercent(group.couponRate)}</Table.Td>
        <Table.Td ta="right">
          <Text size="sm">{formatPercent(group.yieldToMaturity)}</Text>
          {group.currentYieldToMaturity != null && (
            <Text size="xs" c="dimmed">
              сейчас {formatPercent(group.currentYieldToMaturity)}
            </Text>
          )}
        </Table.Td>
        <AmountCells
          currency={group.currency}
          currentAmount={group.currentAmount}
          currentAmountInRub={group.currentAmountInRub}
          revenue={group.revenue}
          revenueInRub={group.revenueInRub}
          revenuePercent={group.revenuePercent}
        />
        <Table.Td>
          <Group gap={ACTION_GAP} wrap="nowrap" justify="flex-end">
            {single ? <PositionActions position={single} onEdit={() => onEdit(single)} /> : <ActionSlots count={2} />}
            <Tooltip label="Ещё покупка этой облигации">
              <ActionIcon variant="subtle" color="gray" aria-label={`Добавить покупку: ${name}`} onClick={onAdd}>
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
      {single == null &&
        expanded &&
        group.positions.map((position) => (
          <Table.Tr key={position.id} bg="var(--mantine-color-default-hover)">
            <Table.Td pl={44}>
              <Text size="xs" c="dimmed">
                покупка
              </Text>
            </Table.Td>
            <Table.Td>
              <BrokersCell brokers={position.broker ? [position.broker] : []} />
            </Table.Td>
            <Table.Td>{formatDate(position.buyDate)}</Table.Td>
            <Table.Td ta="right">{formatNumber(position.quantity)}</Table.Td>
            <Table.Td ta="right">
              <Text size="sm">{formatPercent(position.buyPrice)}</Text>
              <PaidRubCaption position={position} />
            </Table.Td>
            <Table.Td ta="right">{formatPercent(position.currentPrice)}</Table.Td>
            <Table.Td />
            <Table.Td ta="right">{formatPercent(position.yieldToMaturity)}</Table.Td>
            <AmountCells
              currency={position.currency}
              currentAmount={position.currentAmount}
              currentAmountInRub={position.currentAmountInRub}
              revenue={position.revenue}
              revenueInRub={position.revenueInRub}
              revenuePercent={position.revenuePercent}
            />
            <Table.Td>
              <Group gap={ACTION_GAP} wrap="nowrap" justify="flex-end">
                <PositionActions position={position} onEdit={() => onEdit(position)} />
                <ActionSlots count={1} />
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
    </>
  );
}

/** Пустое место вместо кнопок действий - чтобы кнопки соседних строк стояли одна под другой */
function ActionSlots({ count }: { count: number }) {
  return <Box w={count * ACTION_WIDTH + (count - 1) * ACTION_GAP} style={{ flex: 'none' }} />;
}

/** Сколько рублей заплачено, если пользователь это указал - видно, откуда рублёвый доход */
function PaidRubCaption({ position }: { position: PortfolioPosition }) {
  if (position.buyAmountRub == null) {
    return null;
  }
  return (
    <Text size="xs" c="dimmed">
      {money(position.buyAmountRub, 'rub')}
    </Text>
  );
}

function AmountCells({
  currency,
  currentAmount,
  currentAmountInRub,
  revenue,
  revenueInRub,
  revenuePercent,
}: {
  currency: string | null;
  currentAmount: number | null;
  currentAmountInRub: number | null;
  revenue: number | null;
  revenueInRub: number | null;
  revenuePercent: number | null;
}) {
  return (
    <>
      <Table.Td ta="right">
        <Text size="sm">{money(currentAmount, currency)}</Text>
        <RubCaption value={currentAmountInRub} currency={currency} />
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={500} c={revenueColor(revenue)}>
          {signedMoney(revenue, currency)}
        </Text>
        <RubCaption value={revenueInRub} currency={currency} signed />
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={500} c={revenueColor(revenuePercent)}>
          {signedPercent(revenuePercent)}
        </Text>
      </Table.Td>
    </>
  );
}

function PositionActions({ position, onEdit }: { position: PortfolioPosition; onEdit: () => void }) {
  const { remove } = usePortfolioMutations();
  const [confirming, setConfirming] = useState(false);
  const name = position.bondName ?? position.ticker;
  const label = `${name} от ${formatDate(position.buyDate)}`;

  return (
    <Group gap={ACTION_GAP} wrap="nowrap" justify="flex-end">
      <Tooltip label="Изменить">
        <ActionIcon variant="subtle" color="gray" aria-label={`Изменить покупку: ${label}`} onClick={onEdit}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
      <Popover opened={confirming} onChange={setConfirming} position="bottom-end" withArrow shadow="md">
        <Popover.Target>
          <Tooltip label="Удалить" disabled={confirming}>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={`Удалить покупку: ${label}`}
              onClick={() => setConfirming((value) => !value)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <Text size="sm">Удалить покупку {label}?</Text>
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
  );
}

/**
 * Новая покупка или изменение существующей. У новой цена покупки по умолчанию - текущая цена выбранной облигации,
 * пока пользователь не ввёл свою. Облигацию у существующей покупки не поменять - только удалить и добавить заново.
 * У валютной облигации - необязательная сумма в рублях, сколько списал брокер.
 */
function PositionForm({ position, preset, onDone }: { position?: PortfolioPosition; preset?: PresetBond; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { create, update } = usePortfolioMutations();
  const today = todayIso();
  const [ticker, setTicker] = useState<string | null>(position?.ticker ?? preset?.ticker ?? null);
  const [tickerName, setTickerName] = useState<string | null>(preset?.name ?? null);
  const [currency, setCurrency] = useState<string | null>(position?.currency ?? preset?.currency ?? null);
  const [quantity, setQuantity] = useState<number | undefined>(position?.quantity ?? 1);
  const [buyPrice, setBuyPrice] = useState<number | undefined>(position?.buyPrice ?? preset?.currentPrice ?? undefined);
  // пользователь ввёл свою цену - текущая цена облигации её не затирает, даже если пришла позже
  const priceTouched = useRef(position != null);
  const [buyDate, setBuyDate] = useState(position?.buyDate ?? today);
  const [broker, setBroker] = useState<string | null>(position?.broker ?? null);
  const [buyAmountRub, setBuyAmountRub] = useState<number | undefined>(position?.buyAmountRub ?? undefined);
  const [submitted, setSubmitted] = useState(false);
  const foreign = currency != null && !isRubCurrency(currency);

  const errors = {
    ticker: position == null && !ticker ? 'Выберите облигацию' : undefined,
    quantity:
      quantity == null || quantity < 1 || quantity > MAX_POSITION_QUANTITY
        ? `От 1 до ${formatNumber(MAX_POSITION_QUANTITY)}`
        : undefined,
    buyPrice: buyPrice == null || buyPrice <= 0 || buyPrice > MAX_BUY_PRICE ? `Больше 0 и не выше ${MAX_BUY_PRICE} %` : undefined,
    buyDate: !isIsoDate(buyDate) ? 'Укажите дату' : buyDate > today ? 'Не позже сегодня' : undefined,
    buyAmountRub: foreign && buyAmountRub != null && buyAmountRub <= 0 ? 'Больше 0' : undefined,
  };
  const valid = Object.values(errors).every((error) => error == null);
  const mutation = position ? update : create;

  const onTickerChange = (next: string | null) => {
    setTicker(next);
    setTickerName(null);
    setCurrency(null);
    if (!next) {
      return;
    }
    void queryClient
      .fetchQuery({ queryKey: bondKeys.detail(next), queryFn: () => fetchBond(next) })
      .then((bond) => {
        setTickerName(bond.name);
        setCurrency(bond.price?.nominal?.currency ?? null);
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
    // пустая строка - без брокера (в том числе снять брокера у существующей покупки); без рублёвой суммы - по курсу ЦБ
    const request: PortfolioPositionRequest = { quantity, buyPrice, buyDate, broker: broker ?? '' };
    if (foreign && buyAmountRub != null) {
      request.buyAmountRub = buyAmountRub;
    }
    if (position) {
      update.mutate({ id: position.id, ...request }, { onSuccess: onDone });
    } else {
      create.mutate({ ...request, ticker: ticker! }, { onSuccess: onDone });
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
      <NumberField
        label="Количество, шт."
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={MAX_POSITION_QUANTITY}
        allowDecimal={false}
        thousandSeparator=" "
        error={shown(errors.quantity)}
      />
      <NumberField
        label="Цена покупки, % номинала"
        value={buyPrice}
        onChange={(value) => {
          priceTouched.current = true;
          setBuyPrice(value);
        }}
        min={0}
        decimalScale={4}
        decimalSeparator=","
        error={shown(errors.buyPrice)}
      />
      {foreign && (
        <NumberField
          label="Заплачено, ₽"
          description="Сколько рублей списал брокер за облигации, без НКД и комиссии. Пусто - по курсу ЦБ на дату покупки"
          value={buyAmountRub}
          onChange={setBuyAmountRub}
          min={0}
          decimalScale={2}
          decimalSeparator=","
          thousandSeparator=" "
          error={shown(errors.buyAmountRub)}
        />
      )}
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
