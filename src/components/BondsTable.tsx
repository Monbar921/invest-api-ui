import { Anchor, Stack, Text } from '@mantine/core';
import { DataTable, type DataTableColumn, type DataTableSortStatus } from 'mantine-datatable';
import { Link, useNavigate } from 'react-router';
import type { Bond, BondSortField, Page } from '../api/types';
import { PAGE_SIZES, type BondSearchState } from '../lib/bondSearchParams';
import { formatDate, formatMoney, formatNumber, formatPercent, formatTimeToMaturity, plural } from '../lib/format';
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
  riskLevel: 'RISK_LEVEL',
  maturityDate: 'MATURITY_DATE',
};

const columns: DataTableColumn<Bond>[] = [
  {
    accessor: 'ticker',
    title: 'Тикер',
    sortable: true,
    render: (bond) => (
      <Anchor
        component={Link}
        to={`/bonds/${encodeURIComponent(bond.ticker)}`}
        fw={500}
        // строка тоже ведёт в карточку - без stopPropagation переход сработал бы дважды
        onClick={(event) => event.stopPropagation()}
      >
        {bond.ticker}
      </Anchor>
    ),
  },
  { accessor: 'name', title: 'Название', sortable: true, render: (bond) => bond.name ?? '—' },
  {
    accessor: 'price',
    title: 'Цена',
    sortable: true,
    textAlign: 'right',
    render: (bond) => formatMoney(bond.price?.current),
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
    title: 'Купон, % год.',
    sortable: true,
    textAlign: 'right',
    render: (bond) =>
      bond.coupon?.interest == null ? (
        '—'
      ) : (
        <Stack gap={0} align="flex-end">
          <Text size="sm">{formatPercent(bond.coupon.interest)}</Text>
          <Text size="xs" c="dimmed">
            {formatNumber(bond.coupon.quantityPerYear)} {plural(bond.coupon.quantityPerYear, 'раз', 'раза', 'раз')} в год
          </Text>
        </Stack>
      ),
  },
  { accessor: 'riskLevel', title: 'Риск', sortable: true, render: (bond) => <RiskBadge level={bond.riskLevel} /> },
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
