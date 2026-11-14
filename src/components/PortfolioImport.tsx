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
import { IconAlertTriangle, IconFileUpload, IconPlugConnected, IconUpload } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAccountPlan, useBrokerAccounts, useBrokerConnection, useImportMutations, useImports } from '../api/queries';
import type { ImportItem, ImportItemStatus, ImportSource, PortfolioImport as Import } from '../api/types';
import { formatDate, formatDateTime, formatNumber, formatPricePercent } from '../lib/format';
import { ApiErrorText } from './ApiErrorText';
import { ErrorState } from './ErrorState';
import { PlanFeatureHint } from './PlanFeatureHint';

type FileFormat = Exclude<ImportSource, 'TINVEST_API'>;

const SOURCE_LABELS: Record<ImportSource, string> = {
  TINVEST_API: 'Т-Инвестиции по токену',
  CSV: 'Файл CSV',
  SBER_HTML: 'Отчёт Сбербанка',
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
  const [current, setCurrent] = useState<Import | null>(null);
  const { open } = useImportMutations();
  const step = current == null ? 0 : current.status === 'PREVIEW' ? 1 : 2;

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Покупки и продажи облигаций от брокера - без ручного ввода. Сначала покажем, что нашлось, и вы выберете, что добавить.
        Повторный импорт того же отчёта ничего не задвоит.
      </Text>
      {closed && <PlanFeatureHint planTitle={upgrade?.title} />}
      <Stepper active={step} size="sm" allowNextStepsSelect={false}>
        <Stepper.Step label="Источник" description="Токен или файл">
          <SourceStep disabled={closed} onPreview={setCurrent} />
        </Stepper.Step>
        <Stepper.Step label="Предпросмотр" description="Что добавить">
          {current && <PreviewStep current={current} onApplied={setCurrent} onCancel={() => setCurrent(null)} />}
        </Stepper.Step>
        <Stepper.Step label="Отчёт" description="Что получилось">
          {current && <ReportStep current={current} onNew={() => setCurrent(null)} />}
        </Stepper.Step>
      </Stepper>
      {open.isError && <ApiErrorText error={open.error} />}
      <ImportHistory onOpen={(id) => open.mutate(id, { onSuccess: setCurrent })} />
    </Stack>
  );
}

function SourceStep({ disabled, onPreview }: { disabled: boolean; onPreview: (value: Import) => void }) {
  const [source, setSource] = useState<'token' | 'file'>('token');
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
      <Group>
        <Button
          leftSection={<IconUpload size={16} />}
          loading={previewTinvest.isPending}
          disabled={disabled}
          onClick={() => previewTinvest.mutate({ accountIds, from: from || null }, { onSuccess: onPreview })}
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
  return (
    <Stack gap="sm" maw={560}>
      <Select
        label="Формат"
        data={[
          { value: 'CSV', label: 'CSV - свой шаблон (любой брокер)' },
          { value: 'SBER_HTML', label: 'Брокерский отчёт Сбербанка (HTML)' },
        ]}
        value={format}
        onChange={(value) => value && setFormat(value as FileFormat)}
        allowDeselect={false}
        disabled={disabled}
      />
      {format === 'CSV' ? (
        <Text size="xs" c="dimmed">
          Первая строка - заголовки, разделитель «;» или «,». Обязательны: Дата, Операция (покупка / продажа), ISIN или Тикер,
          Количество, Цена (в % номинала). Необязательны: НКД, Комиссия (в валюте номинала), Номер сделки, Брокер.
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          В СберИнвесторе: «Ещё» → «Брокерские отчёты», формат HTML. Берём таблицу сделок купли/продажи ценных бумаг.
        </Text>
      )}
      <FileInput
        label="Файл"
        placeholder="Выберите файл"
        accept={format === 'CSV' ? '.csv,.txt' : '.html,.htm'}
        value={file}
        onChange={setFile}
        leftSection={<IconFileUpload size={16} />}
        clearable
        disabled={disabled}
      />
      <Group>
        <Button
          leftSection={<IconUpload size={16} />}
          loading={previewFile.isPending}
          disabled={disabled || file == null}
          onClick={() => file && previewFile.mutate({ format, file }, { onSuccess: onPreview })}
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
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(items.filter((item) => item.status === 'NEW').map((item) => item.id)),
  );
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
                      aria-label={`Выбрать строку ${item.lineNo}`}
                      checked={selected.has(item.id)}
                      disabled={!item.selectable}
                      onChange={() => onToggle?.(item.id)}
                    />
                  </Table.Td>
                )}
                <Table.Td>{formatDate(item.date)}</Table.Td>
                <Table.Td>{item.kind === 'BUY' ? 'Покупка' : item.kind === 'SELL' ? 'Продажа' : '-'}</Table.Td>
                <Table.Td>
                  <Text size="sm">{item.name ?? item.ticker ?? item.isin ?? item.figi ?? `Строка ${item.lineNo}`}</Text>
                  <Text size="xs" c="dimmed">
                    {[item.ticker, item.isin].filter(Boolean).join(' · ')}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">{item.quantity != null ? formatNumber(item.quantity) : '-'}</Table.Td>
                <Table.Td ta="right">{formatPricePercent(item.price)}</Table.Td>
                <Table.Td ta="right">{item.aci != null ? formatNumber(item.aci) : '-'}</Table.Td>
                <Table.Td ta="right">{item.commission != null ? formatNumber(item.commission) : '-'}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_LABELS[item.status].color} variant="light">
                    {STATUS_LABELS[item.status].label}
                  </Badge>
                  {item.message && (
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
        <Table.ScrollContainer minWidth={600}>
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Когда</Table.Th>
                <Table.Th>Источник</Table.Th>
                <Table.Th>Состояние</Table.Th>
                <Table.Th ta="right">Создано</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {imports.data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{formatDateTime(item.createdAt)}</Table.Td>
                  <Table.Td>
                    {SOURCE_LABELS[item.source]}
                    {item.fileName ? `: ${item.fileName}` : ''}
                  </Table.Td>
                  <Table.Td>{item.status === 'PREVIEW' ? 'Ждёт подтверждения' : 'Подтверждён'}</Table.Td>
                  <Table.Td ta="right">{formatNumber(item.counts.CREATED ?? 0)}</Table.Td>
                  <Table.Td ta="right">
                    <Button size="compact-sm" variant="subtle" onClick={() => onOpen(item.id)}>
                      Открыть
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
