import { BarChart } from '@mantine/charts';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  CopyButton,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconCalendarPlus, IconCheck, IconCopy } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { calendarFeedUrl } from '../api/portfolio';
import { useCalendarLink, useCalendarLinkMutations, usePortfolioCalendar } from '../api/queries';
import type {
  BondEventType,
  PortfolioCalendar,
  PortfolioCalendarEvent,
  PortfolioCalendarMonth,
  PortfolioCalendarTotal,
} from '../api/types';
import { addMonths, todayIso } from '../lib/dates';
import { formatDate, formatDateTime, formatMoney, isRubCurrency, plural } from '../lib/format';
import { ErrorState } from './ErrorState';

const EVENT_TYPES: Record<BondEventType, { label: string; color: string }> = {
  COUPON: { label: 'Купон', color: 'blue' },
  AMORTIZATION: { label: 'Амортизация', color: 'orange' },
  OFFER: { label: 'Оферта', color: 'grape' },
  MATURITY: { label: 'Погашение', color: 'teal' },
};

const PERIODS = [
  { value: '3', label: '3 мес' },
  { value: '6', label: '6 мес' },
  { value: '12', label: 'Год' },
  { value: '36', label: '3 года' },
];

const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' });
const shortMonthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' });

const compactNumberFormat = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

/** Заглавная только первая буква: CSS capitalize сделал бы «Ноябрь 2026 Г.» */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «декабрь 2026» из YYYY-MM */
function monthLabel(month: string, format = monthFormat): string {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  return format.format(new Date(year, monthIndex - 1, 1));
}

function money(value: number | null, currency: string | null): string {
  return formatMoney({ quantity: value, currency });
}

/**
 * «Выплаты» в портфеле: будущие купоны, амортизация, оферты и погашения по облигациям портфеля - суммы на количество,
 * столбики по месяцам, список событий и личная ссылка для подписки в календаре
 */
export function PortfolioPayments({ now = new Date() }: { now?: Date }) {
  const [months, setMonths] = useState('12');
  const to = addMonths(todayIso(now), Number(months));
  const calendar = usePortfolioCalendar(to);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Text size="sm" c="dimmed">
          Будущие выплаты по облигациям портфеля: выплата на облигацию × количество
        </Text>
        <SegmentedControl size="xs" value={months} onChange={setMonths} data={PERIODS} aria-label="Период" />
      </Group>

      {calendar.isPending && <Loader size="sm" />}
      {calendar.isError && <ErrorState error={calendar.error} onRetry={() => void calendar.refetch()} />}
      {calendar.data && <Payments calendar={calendar.data} />}

      <CalendarSubscription />
    </Stack>
  );
}

function Payments({ calendar }: { calendar: PortfolioCalendar }) {
  if (calendar.events.length === 0 && calendar.unknownTickers.length === 0) {
    return <Text c="dimmed">За выбранный период выплат по облигациям портфеля нет.</Text>;
  }
  const unknownCount = calendar.events.filter((event) => event.amountUnknown).length;

  return (
    <>
      <PeriodTotals calendar={calendar} />
      {unknownCount > 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Итог неполный">
          Размер {unknownCount} {plural(unknownCount, 'выплаты', 'выплат', 'выплат')} ещё не объявлен (обычно - купон флоатера):{' '}
          {plural(unknownCount, 'она показана', 'они показаны', 'они показаны')} без суммы и в итог не{' '}
          {plural(unknownCount, 'вошла', 'вошли', 'вошли')}. Настоящая сумма больше.
        </Alert>
      )}
      {calendar.unknownTickers.length > 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Не все облигации в календаре">
          Облигаций {calendar.unknownTickers.join(', ')} больше нет в системе - их выплаты не показаны.
        </Alert>
      )}
      {calendar.months.length > 0 && <MonthsChart months={calendar.months} />}
      <EventsTable events={calendar.events} months={calendar.months} />
      <Text size="xs" c="dimmed">
        Суммы - из графика купонов и амортизации, как во вкладке «События по бумаге» карточки, умноженные на количество облигаций
        во всех покупках. Рубли - по сегодняшнему курсу. Налог не вычтен. У оферты своей выплаты нет: выкуп - по заявке держателя.
      </Text>
    </>
  );
}

/** Итог периода: в рублях и по валютам (валюты не складываются - кроме карточки «в рублях» по сегодняшнему курсу) */
function PeriodTotals({ calendar }: { calendar: PortfolioCalendar }) {
  const foreign = calendar.totals.filter((total) => !isRubCurrency(total.currency));
  return (
    <SimpleGrid cols={{ base: 1, sm: Math.min(1 + foreign.length, 3) }}>
      <Card withBorder padding="md">
        <Text size="sm" c="dimmed">
          Придёт за период, в рублях
        </Text>
        <Text fw={600} size="xl">
          {calendar.amountInRub == null ? '—' : `${calendar.incomplete ? 'от ' : ''}${money(calendar.amountInRub, 'rub')}`}
        </Text>
        <Text size="xs" c="dimmed">
          {calendar.amountInRub == null
            ? 'нет курса одной из валют'
            : `${calendar.events.length} ${plural(calendar.events.length, 'событие', 'события', 'событий')} до ${formatDate(calendar.to)}`}
        </Text>
      </Card>
      {foreign.map((total) => (
        <TotalCard key={total.currency ?? '-'} total={total} />
      ))}
    </SimpleGrid>
  );
}

function TotalCard({ total }: { total: PortfolioCalendarTotal }) {
  return (
    <Card withBorder padding="md">
      <Text size="sm" c="dimmed">
        В валюте, {total.currency?.toUpperCase() ?? '—'}
      </Text>
      <Text fw={600} size="xl">
        {total.incomplete ? 'от ' : ''}
        {money(total.amount, total.currency)}
      </Text>
      {total.amountInRub != null && (
        <Text size="xs" c="dimmed">
          {money(total.amountInRub, 'rub')}
        </Text>
      )}
    </Card>
  );
}

/** Столбики по месяцам в рублях; месяц с необъявленными выплатами помечен «*» */
function MonthsChart({ months }: { months: PortfolioCalendarMonth[] }) {
  const withoutRate = months.some((month) => month.amountInRub == null);
  return (
    <Card withBorder padding="md">
      <Title order={5} mb="sm">
        По месяцам, ₽
      </Title>
      <BarChart
        h={220}
        data={months.map((month) => ({
          month: `${monthLabel(month.month, shortMonthFormat)}${month.incomplete ? '*' : ''}`,
          amount: month.amountInRub ?? 0,
        }))}
        dataKey="month"
        series={[{ name: 'amount', label: 'Выплаты', color: 'teal.6' }]}
        valueFormatter={(value) => money(value, 'rub')}
        // на оси - коротко («140 тыс.»): полная сумма с копейками не помещалась и обрезалась слева; полная - в подсказке
        yAxisProps={{ width: 64, tickFormatter: (value: number) => compactNumberFormat.format(value) }}
        tickLine="y"
      />
      {(months.some((month) => month.incomplete) || withoutRate) && (
        <Text size="xs" c="dimmed" mt="xs">
          {months.some((month) => month.incomplete) && '* в месяце есть выплаты без объявленного размера. '}
          {withoutRate && 'Месяцы без курса одной из валют показаны нулём - суммы в валюте в таблице ниже.'}
        </Text>
      )}
    </Card>
  );
}

function EventsTable({ events, months }: { events: PortfolioCalendarEvent[]; months: PortfolioCalendarMonth[] }) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Дата</Table.Th>
            <Table.Th>Событие</Table.Th>
            <Table.Th>Облигация</Table.Th>
            <Table.Th ta="right">Количество</Table.Th>
            <Table.Th ta="right">На облигацию</Table.Th>
            <Table.Th ta="right">Сумма</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {months.map((month) => (
            <MonthRows key={month.month} month={month} events={events.filter((event) => event.date.startsWith(month.month))} />
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function MonthRows({ month, events }: { month: PortfolioCalendarMonth; events: PortfolioCalendarEvent[] }) {
  return (
    <>
      <Table.Tr bg="var(--mantine-color-gray-light)">
        <Table.Td colSpan={5}>
          <Text fw={600}>{capitalize(monthLabel(month.month))}</Text>
        </Table.Td>
        <Table.Td ta="right">
          <Stack gap={0} align="flex-end">
            {month.totals.map((total) => (
              <Text key={total.currency ?? '-'} fw={600} size="sm">
                {total.incomplete ? 'от ' : ''}
                {money(total.amount, total.currency)}
              </Text>
            ))}
          </Stack>
        </Table.Td>
      </Table.Tr>
      {events.map((event, index) => (
        <EventRow key={`${event.ticker}-${event.type}-${event.date}-${index}`} event={event} />
      ))}
    </>
  );
}

function EventRow({ event }: { event: PortfolioCalendarEvent }) {
  const type = EVENT_TYPES[event.type] ?? { label: event.type, color: 'gray' };
  return (
    <Table.Tr>
      <Table.Td>{formatDate(event.date)}</Table.Td>
      <Table.Td>
        <Badge size="sm" variant="light" color={type.color}>
          {type.label}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Anchor component={Link} to={`/bonds/${encodeURIComponent(event.ticker)}`} size="sm">
          {event.bondName ?? event.ticker}
        </Anchor>
      </Table.Td>
      <Table.Td ta="right">{event.quantity}</Table.Td>
      <Table.Td ta="right">
        {event.amountPerBond != null ? money(event.amountPerBond, event.currency) : noAmountText(event)}
        {event.previousAmountPerBond != null && event.amountPerBond != null && (
          <Text size="xs" c={event.amountPerBond > event.previousAmountPerBond ? 'teal' : 'red'}>
            был {money(event.previousAmountPerBond, event.currency)}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        {event.amount != null ? (
          <>
            <Text size="sm" fw={500}>
              {money(event.amount, event.currency)}
            </Text>
            {!isRubCurrency(event.currency) && event.amountInRub != null && (
              <Text size="xs" c="dimmed">
                {money(event.amountInRub, 'rub')}
              </Text>
            )}
          </>
        ) : (
          noAmountText(event)
        )}
      </Table.Td>
    </Table.Tr>
  );
}

function noAmountText(event: PortfolioCalendarEvent) {
  if (event.amountUnknown) {
    return (
      <Text size="sm" c="yellow.8">
        не объявлен
      </Text>
    );
  }
  const hint =
    event.type === 'OFFER'
      ? 'У оферты своей выплаты нет: облигацию выкупают по заявке держателя'
      : 'Остаток номинала выплачивается в строке амортизации этого дня';
  return (
    <Tooltip label={hint} multiline w={260}>
      <Text size="sm" c="dimmed" component="span">
        —
      </Text>
    </Tooltip>
  );
}

/** Кнопка с подтверждением на месте: вместо неё - вопрос, «Отмена» и подтверждение */
function ConfirmButton({
  label,
  question,
  confirmLabel,
  color,
  loading,
  onConfirm,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  color?: string;
  loading: boolean;
  onConfirm: (done: () => void) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button variant={color ? 'subtle' : 'light'} color={color} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }
  return (
    <Group gap="xs">
      <Text size="sm">{question}</Text>
      <Button size="xs" variant="default" onClick={() => setConfirming(false)}>
        Отмена
      </Button>
      <Button size="xs" color={color} loading={loading} onClick={() => onConfirm(() => setConfirming(false))}>
        {confirmLabel}
      </Button>
    </Group>
  );
}

/**
 * Личная ссылка .ics: календарь подписывается на неё и сам забирает новые выплаты. Адрес виден только сразу после
 * создания - бэк хранит хеш токена; потерянную ссылку заменяют новой
 */
function CalendarSubscription() {
  const link = useCalendarLink();
  const { create, remove } = useCalendarLinkMutations();
  const token = create.data?.token ?? null;
  const url = token ? calendarFeedUrl(token) : null;

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group gap="xs">
          <IconCalendarPlus size={20} />
          <Title order={5}>Подписка в календаре</Title>
        </Group>
        <Text size="sm" c="dimmed">
          Личная ссылка в формате .ics: Google Календарь («Другие календари» → «Добавить по URL»), Apple Календарь («Файл» →
          «Новая подписка на календарь»), Outlook («Добавить календарь» → «Подписаться из Интернета»). Календарь сам обновляет
          выплаты. Ссылка открывает ваши выплаты без входа - не публикуйте её.
        </Text>

        {link.isPending && <Loader size="sm" />}
        {link.isError && <ErrorState error={link.error} onRetry={() => void link.refetch()} />}

        {url && (
          <Group gap="xs" align="flex-end">
            <TextInput
              label="Адрес для подписки"
              description="Показывается один раз: скопируйте его сейчас"
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              style={{ flex: 1 }}
            />
            <CopyButton value={url}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  color={copied ? 'teal' : undefined}
                  leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                  onClick={copy}
                >
                  {copied ? 'Скопировано' : 'Копировать'}
                </Button>
              )}
            </CopyButton>
          </Group>
        )}

        {link.data && !link.data.enabled && !url && (
          <Group>
            <Button loading={create.isPending} onClick={() => create.mutate()}>
              Создать ссылку
            </Button>
          </Group>
        )}

        {link.data?.enabled && (
          <Group gap="sm">
            {!url && (
              <Text size="sm">
                Ссылка создана {formatDateTime(link.data.createdAt)}. Её адрес показывался один раз; если он потерян - создайте
                новую.
              </Text>
            )}
            <ConfirmButton
              label="Новая ссылка"
              question="Прежняя ссылка перестанет работать: календари, подписанные на неё, обновляться не будут."
              confirmLabel="Создать"
              loading={create.isPending}
              onConfirm={(done) => create.mutate(undefined, { onSuccess: done })}
            />
            <ConfirmButton
              label="Отключить ссылку"
              color="red"
              question="Календари, подписанные на ссылку, перестанут обновляться."
              confirmLabel="Отключить"
              loading={remove.isPending}
              onConfirm={(done) =>
                remove.mutate(undefined, {
                  onSuccess: () => {
                    create.reset();
                    done();
                  },
                })
              }
            />
          </Group>
        )}
        {(create.isError || remove.isError) && (
          <Text size="sm" c="red">
            {(create.error ?? remove.error)?.message}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
