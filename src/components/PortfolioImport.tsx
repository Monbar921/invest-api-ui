import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  List,
  Loader,
  MultiSelect,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertTriangle, IconFileUpload, IconPlugConnected, IconUpload } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  importKeys,
  useAccountPlan,
  useBrokerAccounts,
  useBrokerConnection,
  useBrokers,
  useImport,
  useImportMutations,
  useImports,
} from '../api/queries';
import type { Broker, ImportItem, ImportItemStatus, ImportSource, PortfolioImport as Import } from '../api/types';
import { formatDate, formatDateTime, formatNumber, formatPricePercent } from '../lib/format';
import { money } from '../lib/money';
import { ApiErrorText } from './ApiErrorText';
import { ErrorState } from './ErrorState';
import { BrokerSelect } from './BrokerSelect';
import { PlanFeatureHint } from './PlanFeatureHint';

type FileFormat = Exclude<ImportSource, 'TINVEST_API'>;

/** Брокер у сделок импорта по умолчанию - как его назовёт бэк; у своего CSV - из столбца «Брокер» */
const DEFAULT_BROKERS: Record<ImportSource, string | null> = {
  TINVEST_API: 'Т-Инвестиции',
  CSV: null,
  SBER_HTML: 'Сбербанк',
  ALFA_XLSX: 'Альфа-Банк',
};

const FORMAT_HINTS: Record<FileFormat, string> = {
  CSV:
    'Первая строка - заголовки, разделитель «;» или «,». Обязательны: Дата, Операция (покупка / продажа), ISIN или ' +
    'Тикер, Количество, Цена (в % номинала). Необязательны: НКД, Комиссия (в валюте номинала), Номер сделки, Брокер.',
  SBER_HTML: 'В СберИнвесторе: «Ещё» → «Брокерские отчёты», формат HTML. Берём таблицу сделок купли/продажи ценных бумаг.',
  ALFA_XLSX:
    'В Альфа-Инвестициях: «Документы» → «Брокерский отчёт», формат Excel. Берём листы «Завершенные сделки» и ' +
    '«Незавершенные сделки»; акции и фонды из отчёта покажем как «нет в системе».',
};

const FORMAT_ACCEPT: Record<FileFormat, string> = {
  CSV: '.csv,.txt',
  SBER_HTML: '.html,.htm',
  ALFA_XLSX: '.xlsx',
};

const SOURCE_LABELS: Record<ImportSource, string> = {
  TINVEST_API: 'Т-Инвестиции по токену',
  CSV: 'Файл CSV',
  SBER_HTML: 'Отчёт Сбербанка',
  ALFA_XLSX: 'Отчёт Альфа-Банка',
};

const STATUS_LABELS: Record<ImportItemStatus, { label: string; color: string }> = {
  NEW: { label: 'Новая', color: 'blue' },
  POSSIBLE_DUPLICATE: { label: 'Похожа на введённую', color: 'yellow' },
  NEEDS_REVIEW: { label: 'Проверить', color: 'orange' },
  DUPLICATE: { label: 'Уже импортирована', color: 'gray' },
  UNKNOWN_BOND: { label: 'Нет в системе', color: 'red' },
  INVALID: { label: 'Ошибка', color: 'red' },
  CREATED: { label: 'Создана', color: 'teal' },
  FAILED: { label: 'Не создана', color: 'red' },
  SKIPPED: { label: 'Пропущена', color: 'gray' },
};

const STATUS_ORDER = Object.keys(STATUS_LABELS) as ImportItemStatus[];

/** Параметр адреса с открытым импортом: шаг мастера переживает перерисовку страницы и обновление */
const IMPORT_PARAM = 'import';

/** Имя брокера без регистра, пробелов и знаков: «Альфа-Банк» и «АльфаБанк» - один брокер */
const brokerKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Брокер по умолчанию: уже заведённый у пользователя с тем же именем (без учёта знаков) - чтобы импорт не завёл
 * второго брокера рядом с тем, что вводили вручную; иначе - брокер источника
 */
function defaultBroker(source: ImportSource, brokers: Broker[] | undefined): string | null {
  const name = DEFAULT_BROKERS[source];
  if (name == null) {
    return null;
  }
  return brokers?.find((broker) => brokerKey(broker.name) === brokerKey(name))?.name ?? name;
}

/**
 * Вкладка «Импорт»: мастер из трёх шагов - источник (токен T-Invest только на чтение или файл отчёта), предпросмотр
 * сделок с выбором и отчёт. Повтор уже импортированной сделки бэк пропускает; облигации, которых нет в системе,
 * показываются, а не теряются
 */
export function PortfolioImport() {
  const accountPlan = useAccountPlan().data;
  // тариф не загрузился - форма как обычно, закрытую фичу всё равно не даст бэк (402)
  const closed = accountPlan != null && !accountPlan.plan.features.includes('BROKER_IMPORT');
  const upgrade = accountPlan?.plans.find((plan) => plan.paid && plan.features.includes('BROKER_IMPORT'));
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const openedId = Number(searchParams.get(IMPORT_PARAM)) || null;
  const opened = useImport(openedId);
  const current = openedId == null ? null : (opened.data ?? null);
  const mobile = useMediaQuery('(max-width: 36em)');
  const show = (value: Import | number | null) => {
    if (value != null && typeof value === 'object') {
      queryClient.setQueryData(importKeys.detail(value.id), value);
    }
    const id = value == null ? null : typeof value === 'number' ? value : value.id;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id == null) {
          next.delete(IMPORT_PARAM);
        } else {
          next.set(IMPORT_PARAM, String(id));
        }
        return next;
      },
      { replace: true },
    );
  };
  const step = current == null ? 0 : current.status === 'PREVIEW' ? 1 : 2;

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Покупки и продажи облигаций от брокера - без ручного ввода. Сначала покажем, что нашлось, и вы выберете, что добавить.
        Повторный импорт того же отчёта ничего не задвоит.
      </Text>
      {closed && <PlanFeatureHint planTitle={upgrade?.title} />}
      {/* на телефоне - без описаний шагов: три шага с описаниями не помещаются в строку */}
      <Stepper active={step} size={mobile ? 'xs' : 'sm'} allowNextStepsSelect={false}>
        <Stepper.Step label="Источник" description={mobile ? undefined : 'Токен или файл'}>
          {openedId != null && opened.isPending ? (
            <Loader size="sm" mt="md" />
          ) : (
            <SourceStep disabled={closed} onPreview={show} />
          )}
          {openedId != null && opened.isError && <ApiErrorText error={opened.error} />}
        </Stepper.Step>
        <Stepper.Step label="Предпросмотр" description={mobile ? undefined : 'Что добавить'}>
          {current && <PreviewStep key={current.id} current={current} onApplied={show} onCancel={() => show(null)} />}
        </Stepper.Step>
        <Stepper.Step label="Отчёт" description={mobile ? undefined : 'Что получилось'}>
          {current && <ReportStep current={current} onNew={() => show(null)} />}
        </Stepper.Step>
      </Stepper>
      <ImportHistory onOpen={(id) => show(id)} />
    </Stack>
  );
}

function SourceStep({ disabled, onPreview }: { disabled: boolean; onPreview: (value: Import) => void }) {
  const connection = useBrokerConnection();
  const [chosen, setSource] = useState<'token' | 'file' | null>(null);
  // импорт по токену выключен - сразу файл
  const source = chosen ?? (connection.data?.enabled === false ? 'file' : 'token');
  return (
    <Stack gap="md" mt="md">
      <SegmentedControl
        value={source}
        onChange={(value) => setSource(value as 'token' | 'file')}
        data={[
          { value: 'token', label: 'Т-Инвестиции по токену' },
          { value: 'file', label: 'Файл отчёта' },
        ]}
        style={{ alignSelf: 'flex-start' }}
      />
      {source === 'token' ? (
        <TokenSource disabled={disabled} onPreview={onPreview} />
      ) : (
        <FileSource disabled={disabled} onPreview={onPreview} />
      )}
    </Stack>
  );
}

function TokenSource({ disabled, onPreview }: { disabled: boolean; onPreview: (value: Import) => void }) {
  const connection = useBrokerConnection();
  const { connect, disconnect, previewTinvest } = useImportMutations();
  const [token, setToken] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [from, setFrom] = useState('');
  const brokers = useBrokers();
  // undefined - не меняли: брокер по умолчанию (уже заведённый с тем же именем или брокер источника)
  const [chosenBroker, setBroker] = useState<string | null | undefined>(undefined);
  const broker = chosenBroker === undefined ? defaultBroker('TINVEST_API', brokers.data) : chosenBroker;
  const connected = connection.data?.connected === true;
  const accounts = useBrokerAccounts(connected && !disabled);

  if (connection.isPending) {
    return <Loader size="sm" />;
  }
  if (connection.isError) {
    return <ErrorState error={connection.error} onRetry={() => void connection.refetch()} />;
  }
  if (!connection.data.enabled) {
    return <Text c="dimmed">Импорт по токену пока недоступен - загрузите файл отчёта брокера.</Text>;
  }
  if (!connected) {
    return (
      <Stack gap="sm" maw={560}>
        <Text size="sm">
          В приложении Т-Инвестиций откройте «Настройки» → «Токены T-Invest API» и создайте токен <b>«Только для чтения»</b>. С
          ним нельзя совершать сделки - токен с правами на торговлю не примем. Храним его зашифрованным, отключить можно в любой
          момент.
        </Text>
        <PasswordInput
          label="Токен T-Invest API"
          placeholder="t.…"
          value={token}
          onChange={(event) => setToken(event.currentTarget.value)}
          autoComplete="off"
          disabled={disabled}
        />
        <Group>
          <Button
            leftSection={<IconPlugConnected size={16} />}
            loading={connect.isPending}
            disabled={disabled || token.trim() === ''}
            onClick={() => connect.mutate(token.trim(), { onSuccess: () => setToken('') })}
          >
            Подключить
          </Button>
        </Group>
        {connect.isError && <ApiErrorText error={connect.error} />}
      </Stack>
    );
  }
  return (
    <Stack gap="sm" maw={560}>
      <Text size="sm">
        Токен …{connection.data.tokenHint} подключён {formatDateTime(connection.data.connectedAt)}
        {connection.data.lastImportAt && `, последняя загрузка ${formatDateTime(connection.data.lastImportAt)}`}.
      </Text>
      {accounts.isError && <ApiErrorText error={accounts.error} />}
      <MultiSelect
        label="Счета"
        placeholder={accountIds.length === 0 ? 'Все счета' : undefined}
        data={(accounts.data ?? []).map((account) => ({
          value: account.id,
          label: `${account.name}${account.closed ? ' (закрыт)' : ''}`,
        }))}
        value={accountIds}
        onChange={setAccountIds}
        disabled={disabled || accounts.isPending}
        clearable
      />
      <TextInput
        type="date"
        label="С даты"
        description="Пусто - вся история; тогда же покажем остатки позиций без покупок в истории"
        value={from}
        onChange={(event) => setFrom(event.currentTarget.value)}
        disabled={disabled}
        maw={220}
      />
      <BrokerSelect value={broker} onChange={setBroker} />
      <Group>
        <Button
          leftSection={<IconUpload size={16} />}
          loading={previewTinvest.isPending}
          disabled={disabled}
          onClick={() => previewTinvest.mutate({ accountIds, from: from || null, broker }, { onSuccess: onPreview })}
        >
          Загрузить сделки
        </Button>
        <Button variant="subtle" color="red" loading={disconnect.isPending} onClick={() => disconnect.mutate()}>
          Отключить токен
        </Button>
      </Group>
      {previewTinvest.isError && <ApiErrorText error={previewTinvest.error} />}
      {disconnect.isError && <ApiErrorText error={disconnect.error} />}
    </Stack>
  );
}

function FileSource({ disabled, onPreview }: { disabled: boolean; onPreview: (value: Import) => void }) {
  const { previewFile } = useImportMutations();
  const [format, setFormat] = useState<FileFormat>('CSV');
  const [file, setFile] = useState<File | null>(null);
  const brokers = useBrokers();
  const [chosenBroker, setBroker] = useState<string | null | undefined>(undefined);
  const broker = chosenBroker === undefined ? defaultBroker(format, brokers.data) : chosenBroker;
  return (
    <Stack gap="sm" maw={560}>
      <Select
        label="Формат"
        data={[
          { value: 'CSV', label: 'CSV - свой шаблон (любой брокер)' },
          { value: 'SBER_HTML', label: 'Брокерский отчёт Сбербанка (HTML)' },
          { value: 'ALFA_XLSX', label: 'Брокерский отчёт Альфа-Банка (Excel)' },
        ]}
        value={format}
        onChange={(value) => {
          if (value) {
            setFormat(value as FileFormat);
            setBroker(undefined);
            setFile(null);
          }
        }}
        allowDeselect={false}
        disabled={disabled}
      />
      <Text size="xs" c="dimmed">
        {FORMAT_HINTS[format]}
      </Text>
      <FileInput
        label="Файл"
        placeholder="Выберите файл"
        accept={FORMAT_ACCEPT[format]}
        value={file}
        onChange={setFile}
        leftSection={<IconFileUpload size={16} />}
        clearable
        disabled={disabled}
      />
      <BrokerSelect value={broker} onChange={setBroker} />
      <Group>
        <Button
          leftSection={<IconUpload size={16} />}
          loading={previewFile.isPending}
          disabled={disabled || file == null}
          onClick={() => file && previewFile.mutate({ format, file, broker }, { onSuccess: onPreview })}
        >
          Загрузить
        </Button>
      </Group>
      {previewFile.isError && <ApiErrorText error={previewFile.error} />}
    </Stack>
  );
}

function PreviewStep({
  current,
  onApplied,
  onCancel,
}: {
  current: Import;
  onApplied: (value: Import) => void;
  onCancel: () => void;
}) {
  const items = current.items ?? [];
  const { apply } = useImportMutations();
  // по умолчанию выбраны только новые сделки: похожие на введённые вручную и остатки позиций - на усмотрение
  const [chosen, setSelected] = useState<Set<number>>(
    () => new Set(items.filter((item) => item.status === 'NEW').map((item) => item.id)),
  );
  // строка могла перестать быть выбираемой (предпросмотр перечитан: сделку с тех пор импортировали)
  const selected = new Set(items.filter((item) => item.selectable && chosen.has(item.id)).map((item) => item.id));
  const toggle = (id: number) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <Stack gap="md" mt="md">
      <Summary current={current} />
      <ItemsTable items={items} selected={selected} onToggle={toggle} />
      <Group>
        <Button
          loading={apply.isPending}
          disabled={selected.size === 0}
          onClick={() => apply.mutate({ id: current.id, itemIds: [...selected] }, { onSuccess: onApplied })}
        >
          Импортировать выбранные ({selected.size})
        </Button>
        <Button variant="default" onClick={onCancel}>
          Отмена
        </Button>
      </Group>
      {apply.isError && <ApiErrorText error={apply.error} />}
    </Stack>
  );
}

function ReportStep({ current, onNew }: { current: Import; onNew: () => void }) {
  return (
    <Stack gap="md" mt="md">
      <Summary current={current} />
      <ItemsTable items={current.items ?? []} />
      <Group>
        <Button onClick={onNew}>Новый импорт</Button>
        <Anchor component={Link} to="/portfolio" size="sm">
          К покупкам
        </Anchor>
      </Group>
    </Stack>
  );
}

/** Счётчики по статусам, предупреждения и облигации, которых нет в системе */
function Summary({ current }: { current: Import }) {
  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          {SOURCE_LABELS[current.source]}
          {current.fileName ? `: ${current.fileName}` : ''}
        </Text>
        {STATUS_ORDER.filter((status) => (current.counts[status] ?? 0) > 0).map((status) => (
          <Badge key={status} color={STATUS_LABELS[status].color} variant="light">
            {STATUS_LABELS[status].label}: {current.counts[status]}
          </Badge>
        ))}
      </Group>
      {current.skippedOperations > 0 && (
        <Text size="xs" c="dimmed">
          Пропущено операций, которые не сделки с облигациями (акции, фонды, РЕПО): {current.skippedOperations}.
        </Text>
      )}
      {current.warnings.length > 0 && (
        <Alert color="yellow" icon={<IconAlertTriangle size={16} />} title="Обратите внимание">
          <List size="sm">
            {current.warnings.map((warning) => (
              <List.Item key={warning}>{warning}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      {current.unknownBonds.length > 0 && (
        <Alert color="red" variant="light" title="Облигаций нет в системе - их сделки не импортированы">
          <List size="sm">
            {current.unknownBonds.map((bond) => (
              <List.Item key={`${bond.isin}-${bond.figi}-${bond.ticker}`}>
                {bond.name ?? bond.ticker ?? '-'}
                {bond.isin ? `, ISIN ${bond.isin}` : bond.figi ? `, FIGI ${bond.figi}` : ''} - сделок: {formatNumber(bond.trades)}
              </List.Item>
            ))}
          </List>
        </Alert>
      )}
    </Stack>
  );
}

/** Сделки импорта; с selected - с флажками у тех, что можно выбрать */
function ItemsTable({
  items,
  selected,
  onToggle,
}: {
  items: ImportItem[];
  selected?: Set<number>;
  onToggle?: (id: number) => void;
}) {
  return (
    <Card withBorder padding={0}>
      <Table.ScrollContainer minWidth={900}>
        <Table verticalSpacing="xs" highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {selected && <Table.Th w={40} />}
              <Table.Th>Дата</Table.Th>
              <Table.Th>Операция</Table.Th>
              <Table.Th>Облигация</Table.Th>
              <Table.Th ta="right">Кол-во</Table.Th>
              <Table.Th ta="right">Цена</Table.Th>
              <Table.Th ta="right">НКД</Table.Th>
              <Table.Th ta="right">Комиссия</Table.Th>
              <Table.Th>Статус</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                {selected && (
                  <Table.Td>
                    <Checkbox
                      aria-label={`Выбрать: ${itemTitle(item)}, ${formatDate(item.date)}`}
                      checked={selected.has(item.id)}
                      disabled={!item.selectable}
                      onChange={() => onToggle?.(item.id)}
                    />
                  </Table.Td>
                )}
                <Table.Td>{formatDate(item.date)}</Table.Td>
                <Table.Td>{item.kind === 'BUY' ? 'Покупка' : item.kind === 'SELL' ? 'Продажа' : '—'}</Table.Td>
                <Table.Td>
                  <Text size="sm">{itemTitle(item)}</Text>
                  <Text size="xs" c="dimmed">
                    {/* у ОФЗ тикер и ISIN часто совпадают - не повторяем */}
                    {[...new Set([item.ticker, item.isin].filter(Boolean))].join(' · ')}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{formatNumber(item.quantity)}</Table.Td>
                <Table.Td ta="right">{formatPricePercent(item.price)}</Table.Td>
                <Table.Td ta="right">{money(item.aci, item.currency)}</Table.Td>
                <Table.Td ta="right">{money(item.commission, item.currency)}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_LABELS[item.status].color} variant="light">
                    {STATUS_LABELS[item.status].label}
                  </Badge>
                  {/* сообщение, повторяющее значок («Уже импортирована»), не показываем */}
                  {item.message && item.message.toLowerCase() !== STATUS_LABELS[item.status].label.toLowerCase() && (
                    <Text size="xs" c="dimmed" maw={320}>
                      {item.message}
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

function itemTitle(item: ImportItem): string {
  return item.name ?? item.ticker ?? item.isin ?? item.figi ?? `Строка ${item.lineNo}`;
}

/** Последние импорты: предпросмотр можно открыть и подтвердить позже, отчёт - посмотреть */
function ImportHistory({ onOpen }: { onOpen: (id: number) => void }) {
  const imports = useImports();
  if (!imports.data || imports.data.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <Text fw={500}>Последние импорты</Text>
      <Card withBorder padding={0}>
        <Stack gap={0}>
          {imports.data.map((item, index) => (
            <Group
              key={item.id}
              justify="space-between"
              wrap="nowrap"
              gap="sm"
              px="md"
              py="xs"
              style={index > 0 ? { borderTop: '1px solid var(--mantine-color-default-border)' } : undefined}
            >
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text size="sm" truncate>
                  {SOURCE_LABELS[item.source]}
                  {item.fileName ? `: ${item.fileName}` : ''}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatDateTime(item.createdAt)} ·{' '}
                  {item.status === 'PREVIEW'
                    ? 'ждёт подтверждения'
                    : `подтверждён, создано: ${formatNumber(item.counts.CREATED ?? 0)}`}
                </Text>
              </Stack>
              <Button size="compact-sm" variant="subtle" onClick={() => onOpen(item.id)}>
                Открыть
              </Button>
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
