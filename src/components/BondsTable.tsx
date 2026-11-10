import { Anchor, Group, Stack, Text } from '@mantine/core';
import { DataTable, type DataTableColumn, type DataTableSortStatus } from 'mantine-datatable';
import { Link, useNavigate } from 'react-router';
import type { Bond, BondSortField, Coupon, Page, Price } from '../api/types';
import { PAGE_SIZES, type BondSearchState } from '../lib/bondSearchParams';
import {
  couponTypeLabel,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRub,
  formatTimeToMaturity,
  isRubCurrency,
  plural,
} from '../lib/format';
import { BondAlertsButton } from './BondAlertsButton';
import { RiskBadge } from './RiskBadge';

interface Props {
  data: Page<Bond> | undefined;
  fetching: boolean;
  state: BondSearchState;
  onChange: (patch: Partial<BondSearchState>, options?: { resetPage?: boolean }) => void;
}

// колонка таблицы -> поле сортировки на бэке
const SORT_FIELDS: Record<string, BondSortField> = {
  ticker: 'TICKER',
  name: 'NAME',
  price: 'PRICE',
  percentagePrice: 'PERCENTAGE_PRICE',
  coupon: 'COUPON_INTEREST',
  yieldToMaturity: 'YIELD_TO_MATURITY',
  yieldToOffer: 'YIELD_TO_OFFER',
  riskLevel: 'RISK_LEVEL',
  maturityDate: 'MATURITY_DATE',
};

const columns: DataTableColumn<Bond>[] = [
  {
    accessor: 'ticker',
    title: 'Тикер',
    sortable: true,
    render: (bond) => (
      <Group gap={4} wrap="nowrap">
        <Anchor
          component={Link}
          to={`/bonds/${encodeURIComponent(bond.ticker)}`}
          fw={500}
          // строка тоже ведёт в карточку - без stopPropagation переход сработал бы дважды
          onClick={(event) => event.stopPropagation()}
        >
          {bond.ticker}
        </Anchor>
        <BondAlertsButton ticker={bond.ticker} name={bond.name} />
      </Group>
    ),
  },
  { accessor: 'name', title: 'Название', sortable: true, render: (bond) => bond.name ?? '—' },
  {
    accessor: 'price',
    title: 'Цена, ₽',
    sortable: true,
    textAlign: 'right',
    render: (bond) => <PriceCell price={bond.price} />,
  },
  {
    accessor: 'percentagePrice',
    title: '% номинала',
    sortable: true,
    textAlign: 'right',
    render: (bond) => formatPercent(bond.price?.percentagePrice),
  },
  {
    accessor: 'coupon',
    // сумма купонов за год к текущей цене - не ставка купона от номинала
    title: (
      <>
        Купон,
        <br />% к цене
      </>
    ),
    sortable: true,
    textAlign: 'right',
    render: (bond) => <CouponCell coupon={bond.coupon} />,
  },
  {
    accessor: 'yieldToMaturity',
    // длинные заголовки в две строки, иначе таблица не помещается по ширине
    title: (
      <>
        К погашению,
        <br />% год.
      </>
    ),
    sortable: true,
    textAlign: 'right',
    render: (bond) => formatPercent(bond.coupon?.yieldToMaturity),
  },
  {
    accessor: 'yieldToOffer',
    title: (
      <>
        К оферте,
        <br />% год.
      </>
    ),
    sortable: true,
    textAlign: 'right',
    render: (bond) => <OfferYieldCell bond={bond} />,
  },
  {
    accessor: 'riskLevel',
    title: 'Риск',
    sortable: true,
    // ширина под «Средний»: без неё узкая колонка обрезала бейдж до «СР…»
    width: 120,
    noWrap: true,
    render: (bond) => <RiskBadge level={bond.riskLevel} />,
  },
  {
    accessor: 'maturityDate',
    title: 'Погашение',
    sortable: true,
    render: (bond) => (
      <Stack gap={0}>
        <Text size="sm">{formatDate(bond.maturityDate)}</Text>
        <Text size="xs" c="dimmed">
          {formatTimeToMaturity(bond.maturityDate)}
        </Text>
      </Stack>
    ),
  },
];

export function BondsTable({ data, fetching, state, onChange }: Props) {
  const navigate = useNavigate();

  const sortStatus: DataTableSortStatus<Bond> = {
    columnAccessor: Object.keys(SORT_FIELDS).find((column) => SORT_FIELDS[column] === state.sortField) ?? 'price',
    direction: state.sortOrder === 'ASC' ? 'asc' : 'desc',
  };

  return (
    <DataTable<Bond>
      withTableBorder
      borderRadius="md"
      highlightOnHover
      minHeight={data?.content.length ? undefined : 240}
      idAccessor="uid"
      records={data?.content ?? []}
      columns={columns}
      fetching={fetching}
      noRecordsText="Облигаций под эти фильтры нет"
      onRowClick={({ record }) => navigate(`/bonds/${encodeURIComponent(record.ticker)}`)}
      sortStatus={sortStatus}
      onSortStatusChange={(status) =>
        onChange({
          sortField: SORT_FIELDS[String(status.columnAccessor)] ?? state.sortField,
          sortOrder: status.direction === 'asc' ? 'ASC' : 'DESC',
        })
      }
      page={state.page}
      onPageChange={(page) => onChange({ page }, { resetPage: false })}
      totalRecords={data?.totalElements ?? 0}
      recordsPerPage={state.size}
      recordsPerPageOptions={PAGE_SIZES}
      onRecordsPerPageChange={(size) => onChange({ size })}
      recordsPerPageLabel="На странице"
      paginationText={({ from, to, totalRecords }) => `${from}–${to} из ${totalRecords}`}
    />
  );
}

// подборки и эмитент: порядок задаёт бэк, сортировки по колонкам нет
const fixedOrderColumns = columns.map((column) => ({ ...column, sortable: false }));

interface FixedOrderProps {
  bonds: Bond[];
  fetching?: boolean;
  emptyText: string;
  /** Пагинация с сервера; не задана - все строки сразу */
  pagination?: { page: number; size: number; total: number; onPageChange: (page: number) => void };
}

/** Те же колонки, что у списка облигаций, но в порядке от бэка: подборка, выпуски эмитента */
export function FixedOrderBondsTable({ bonds, fetching = false, emptyText, pagination }: FixedOrderProps) {
  const navigate = useNavigate();
  const common = {
    withTableBorder: true,
    borderRadius: 'md',
    highlightOnHover: true,
    minHeight: bonds.length ? undefined : 160,
    idAccessor: 'uid' as const,
    records: bonds,
    columns: fixedOrderColumns,
    fetching,
    noRecordsText: emptyText,
    onRowClick: ({ record }: { record: Bond }) => navigate(`/bonds/${encodeURIComponent(record.ticker)}`),
  };

  if (!pagination) {
    return <DataTable<Bond> {...common} />;
  }
  return (
    <DataTable<Bond>
      {...common}
      page={pagination.page}
      onPageChange={pagination.onPageChange}
      totalRecords={pagination.total}
      recordsPerPage={pagination.size}
      paginationText={({ from, to, totalRecords }) => `${from}–${to} из ${totalRecords}`}
    />
  );
}

/** Цена в рублях - по ней идёт сортировка; у облигаций в валюте под ней цена в валюте облигации */
function PriceCell({ price }: { price: Price | null }) {
  const current = price?.current;
  const foreign = current?.quantity != null && !isRubCurrency(current.currency);

  return (
    <Stack gap={0} align="flex-end">
      <Text size="sm">{formatRub(price?.currentInRub)}</Text>
      {foreign && (
        <Text size="xs" c="dimmed">
          {formatMoney(current)}
        </Text>
      )}
    </Stack>
  );
}

/** Доходность к оферте и под ней дата оферты; без оферты - прочерк */
function OfferYieldCell({ bond }: { bond: Bond }) {
  if (!bond.offerDate) {
    return '—';
  }

  return (
    <Stack gap={0} align="flex-end">
      <Text size="sm">{formatPercent(bond.coupon?.yieldToOffer)}</Text>
      <Text size="xs" c="dimmed">
        {formatDate(bond.offerDate)}
      </Text>
    </Stack>
  );
}

/** Купонная доходность, под ней тип купона и число выплат: «постоянный · 12 раз в год» */
function CouponCell({ coupon }: { coupon: Coupon | null }) {
  if (!coupon) {
    return '—';
  }

  const payments = `${formatNumber(coupon.quantityPerYear)} ${plural(coupon.quantityPerYear, 'раз', 'раза', 'раз')} в год`;
  const type = couponTypeLabel(coupon.isFixed);

  return (
    <Stack gap={0} align="flex-end">
      <Text size="sm">{formatPercent(coupon.interest)}</Text>
      <Text size="xs" c="dimmed">
        {type ? `${type} · ${payments}` : payments}
      </Text>
    </Stack>
  );
}
