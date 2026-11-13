import { Anchor, Card, Group, SegmentedControl, Stack, Table, Text, Tooltip } from '@mantine/core';
import { Link } from 'react-router';
import type { PortfolioClosedPosition, PortfolioIncome } from '../api/types';
import { formatDate, formatNumber, formatPercent, plural } from '../lib/format';
import { money, revenueColor, signedMoney, signedPercent } from '../lib/money';

/** Ставка НДФЛ для полного дохода: как в калькуляторе - 13 или 15 %, или без налога */
const TAX_RATE_OPTIONS = [
  { value: 'none', label: 'Без НДФЛ' },
  { value: '13', label: 'НДФЛ 13 %' },
  { value: '15', label: 'НДФЛ 15 %' },
];

export function TaxRateControl({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <SegmentedControl size="xs" data={TAX_RATE_OPTIONS} value={value} onChange={onChange} aria-label="Ставка НДФЛ" />;
}

/** Почему итог неполный - текст подсказки */
function incompleteReason(income: PortfolioIncome): string {
  const reason =
    income.unknownCouponCount > 0
      ? `у ${income.unknownCouponCount} ${plural(income.unknownCouponCount, 'полученного купона', 'полученных купонов', 'полученных купонов')} нет размера в графике - в доход они не вошли`
      : 'не для всех облигаций известны НКД, цена, курс или выплаты (история хранится 3 года)';
  return `Итог неполный: ${reason}. Настоящий доход может отличаться.`;
}

/**
 * Полный доход портфеля в рублях: после налога, в % к вложенному и XIRR. Ниже - из чего он сложился.
 */
export function IncomeSummaryCard({ income }: { income: PortfolioIncome }) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text size="sm" c="dimmed">
          Полный доход, в рублях
        </Text>
        {income.xirr != null && (
          <Tooltip label="XIRR: годовая доходность с учётом дат всех вложений и выплат, до налога" multiline w={260}>
            <Text size="sm" fw={500} style={{ cursor: 'help' }}>
              XIRR {formatPercent(income.xirr)}
            </Text>
          </Tooltip>
        )}
      </Group>
      <Text fw={600} size="xl" c={revenueColor(income.fullIncome)}>
        {signedMoney(income.fullIncome, 'rub')}
        {income.incomplete && <IncompleteMark income={income} />}
      </Text>
      <Text size="xs" c="dimmed">
        {signedPercent(income.fullIncomePercent)} к вложенному · все сделки, по курсам ЦБ на их даты
      </Text>
      <IncomeBreakdown income={income} />
    </Card>
  );
}

function IncompleteMark({ income }: { income: PortfolioIncome }) {
  return (
    <Tooltip label={incompleteReason(income)} multiline w={300}>
      <Text component="span" c="orange" ml={4} style={{ cursor: 'help' }} aria-label="Итог неполный">
        *
      </Text>
    </Tooltip>
  );
}

/** Из чего сложился доход: цена, купоны, НКД, комиссии, налог */
export function IncomeBreakdown({ income }: { income: PortfolioIncome }) {
  const rows: [string, number | null][] = [
    ['Доход от цены', income.priceIncome],
    ['Купоны', income.couponIncome],
    ['НКД', income.aciIncome],
    ['Комиссии', income.commission === 0 ? 0 : -income.commission],
  ];
  if (income.taxRatePercent != null) {
    rows.push([`НДФЛ ${formatPercent(income.taxRatePercent)}`, income.tax == null ? null : -income.tax]);
  }
  return (
    <Stack gap={2} mt="xs">
      {rows.map(([label, value]) => (
        <Group key={label} justify="space-between" gap="xs" wrap="nowrap">
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text size="xs">{signedMoney(value, income.currency)}</Text>
        </Group>
      ))}
      {income.amortizationIncome > 0 && (
        <Text size="xs" c="dimmed">
          в доходе от цены - {money(income.amortizationIncome, income.currency)} возвращённого номинала (амортизация)
        </Text>
      )}
    </Stack>
  );
}

/** Ячейки полного дохода и XIRR в строке облигации */
export function IncomeCells({ income }: { income: PortfolioIncome | null | undefined }) {
  if (!income) {
    return (
      <>
        <Table.Td ta="right">—</Table.Td>
        <Table.Td ta="right">—</Table.Td>
      </>
    );
  }
  return (
    <>
      <Table.Td ta="right">
        <Tooltip label={<IncomeBreakdown income={income} />} w={260}>
          <Text size="sm" fw={500} c={revenueColor(income.fullIncome)} style={{ cursor: 'help' }}>
            {signedMoney(income.fullIncome, income.currency)}
            {income.incomplete && <IncompleteMark income={income} />}
          </Text>
        </Tooltip>
        <Text size="xs" c={revenueColor(income.fullIncomePercent) ?? 'dimmed'}>
          {signedPercent(income.fullIncomePercent)}
        </Text>
      </Table.Td>
      <Table.Td ta="right">{formatPercent(income.xirr)}</Table.Td>
    </>
  );
}

/** История закрытых позиций: всё продано или погашено */
export function ClosedPositions({ closed }: { closed: PortfolioClosedPosition[] }) {
  if (closed.length === 0) {
    return null;
  }
  return (
    <Stack gap="xs">
      <Text fw={600}>Закрытые позиции</Text>
      <Card withBorder padding={0}>
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Облигация</Table.Th>
                <Table.Th ta="right">Куплено, шт.</Table.Th>
                <Table.Th>Даты</Table.Th>
                <Table.Th ta="right">Полный доход</Table.Th>
                <Table.Th ta="right">XIRR</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {closed.map((position) => (
                <Table.Tr key={position.ticker}>
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
                      {position.ticker}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{formatNumber(position.quantity)}</Table.Td>
                  <Table.Td>
                    {formatDate(position.firstBuyDate)} – {formatDate(position.closeDate)}
                  </Table.Td>
                  <IncomeCells income={position.income} />
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
