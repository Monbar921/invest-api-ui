import {
  Alert,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useProfitCalculation } from '../api/queries';
import type { Bond, ExitType, ProfitCalculation, ProfitCalculationRequest } from '../api/types';
import { isIsoDate, todayIso, toIsoDate } from '../lib/dates';
import { formatDate, formatMoney, formatNumber, formatPercent, plural } from '../lib/format';
import { ErrorState } from './ErrorState';

/** Пауза после правки формы, прежде чем пересчитывать */
export const CALCULATION_DELAY_MS = 400;

/** Ставки НДФЛ для резидентов: 13% и 15% с дохода выше 2,4 млн ₽ в год */
const TAX_RATES = ['13', '15'] as const;
type TaxRate = (typeof TAX_RATES)[number];

const EXIT_LABELS: Record<ExitType, string> = {
  SALE: 'Продажа',
  OFFER: 'Выкуп по оферте',
  MATURITY: 'Погашение',
};

interface FormErrors {
  quantity?: string;
  buyDate?: string;
  sellDate?: string;
  buyPrice?: string;
  sellPrice?: string;
}

/** Форма калькулятора дохода по облигации и результат расчёта; пересчёт - после паузы в правке формы */
export function ProfitCalculator({ bond }: { bond: Bond }) {
  const today = todayIso();
  const maturityDate = toIsoDate(bond.maturityDate);
  const offerDate = toIsoDate(bond.offerDate);
  const currentPercent = bond.price?.percentagePrice ?? undefined;

  const [quantity, setQuantity] = useState<number | undefined>(1);
  const [buyDate, setBuyDate] = useState(today);
  const [sellDate, setSellDate] = useState(maturityDate ?? '');
  const [buyPrice, setBuyPrice] = useState<number | undefined>(currentPercent);
  const [sellPrice, setSellPrice] = useState<number | undefined>(currentPercent);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState<TaxRate>('13');

  // в дату погашения или оферты облигацию выкупают по номиналу - цена продажи не нужна
  const exitAtPar = Boolean((maturityDate && sellDate >= maturityDate) || (offerDate && sellDate === offerDate));

  const errors = validate({ today, maturityDate, quantity, buyDate, sellDate, buyPrice, sellPrice, exitAtPar });
  const valid = Object.keys(errors).length === 0;

  // зависимости - значения полей, а не объект: новый объект на каждом рендере перезапускал бы паузу бесконечно
  const parameters = useMemo<ProfitCalculationRequest>(
    () => ({
      buyDate,
      sellDate,
      quantity,
      buyPricePercent: buyPrice,
      sellPricePercent: exitAtPar ? undefined : sellPrice,
      taxRatePercent: taxEnabled ? Number(taxRate) : undefined,
    }),
    [buyDate, sellDate, quantity, buyPrice, sellPrice, exitAtPar, taxEnabled, taxRate],
  );
  const [debounced] = useDebouncedValue(parameters, CALCULATION_DELAY_MS);
  const calculation = useProfitCalculation(bond.ticker, debounced, valid && debounced === parameters);

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="md">
          <Title order={4}>Период и цены</Title>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
            <NumberInput
              label="Количество, шт."
              value={quantity ?? ''}
              onChange={(value) => setQuantity(typeof value === 'number' ? value : undefined)}
              min={1}
              allowDecimal={false}
              thousandSeparator=" "
              error={errors.quantity}
            />
            <TextInput
              label="Дата покупки"
              type="date"
              value={buyDate}
              min={today}
              onChange={(event) => setBuyDate(event.currentTarget.value)}
              error={errors.buyDate}
            />
            <NumberInput
              label="Цена покупки, % номинала"
              value={buyPrice ?? ''}
              onChange={(value) => setBuyPrice(typeof value === 'number' ? value : undefined)}
              min={0}
              decimalScale={4}
              decimalSeparator=","
              error={errors.buyPrice}
            />
            <TextInput
              label="Дата продажи"
              type="date"
              value={sellDate}
              min={buyDate}
              onChange={(event) => setSellDate(event.currentTarget.value)}
              error={errors.sellDate}
            />
            <NumberInput
              label="Цена продажи, % номинала"
              value={exitAtPar ? 100 : (sellPrice ?? '')}
              onChange={(value) => setSellPrice(typeof value === 'number' ? value : undefined)}
              min={0}
              decimalScale={4}
              decimalSeparator=","
              disabled={exitAtPar}
              description={exitAtPar ? 'выкуп по номиналу' : 'ваш прогноз цены'}
              error={errors.sellPrice}
            />
          </SimpleGrid>
          <Group gap="xl" wrap="wrap">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Продать:
              </Text>
              {offerDate && offerDate > today && (
                <Button size="xs" variant="light" onClick={() => setSellDate(offerDate)}>
                  В оферту {formatDate(offerDate)}
                </Button>
              )}
              {maturityDate && (
                <Button size="xs" variant="light" onClick={() => setSellDate(maturityDate)}>
                  При погашении {formatDate(maturityDate)}
                </Button>
              )}
            </Group>
            <Group gap="xs">
              <Switch
                label="Учитывать НДФЛ"
                checked={taxEnabled}
                onChange={(event) => setTaxEnabled(event.currentTarget.checked)}
              />
              <SegmentedControl
                size="xs"
                aria-label="Ставка НДФЛ"
                data={TAX_RATES.map((rate) => ({ value: rate, label: `${rate} %` }))}
                value={taxRate}
                onChange={(rate) => setTaxRate(rate as TaxRate)}
                disabled={!taxEnabled}
              />
            </Group>
          </Group>
        </Stack>
      </Card>

      {calculation.isError ? (
        <ErrorState error={calculation.error} onRetry={() => calculation.refetch()} />
      ) : calculation.data ? (
        <CalculationResult result={calculation.data} updating={calculation.isFetching || !valid} />
      ) : (
        valid && (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        )
      )}
    </Stack>
  );
}

function validate({
  today,
  maturityDate,
  quantity,
  buyDate,
  sellDate,
  buyPrice,
  sellPrice,
  exitAtPar,
}: {
  today: string;
  maturityDate: string | null;
  quantity: number | undefined;
  buyDate: string;
  sellDate: string;
  buyPrice: number | undefined;
  sellPrice: number | undefined;
  exitAtPar: boolean;
}): FormErrors {
  const errors: FormErrors = {};
  if (!quantity || quantity < 1) {
    errors.quantity = 'Хотя бы одна облигация';
  }
  if (!isIsoDate(buyDate)) {
    errors.buyDate = 'Укажите дату';
  } else if (buyDate < today) {
    errors.buyDate = 'Не раньше сегодняшнего дня';
  } else if (maturityDate && buyDate >= maturityDate) {
    errors.buyDate = `Облигация погашается ${formatDate(maturityDate)}`;
  }
  if (!isIsoDate(sellDate)) {
    errors.sellDate = 'Укажите дату';
  } else if (isIsoDate(buyDate) && sellDate <= buyDate) {
    errors.sellDate = 'Позже даты покупки';
  }
  if (buyPrice !== undefined && buyPrice <= 0) {
    errors.buyPrice = 'Больше нуля';
  }
  if (!exitAtPar && sellPrice !== undefined && sellPrice <= 0) {
    errors.sellPrice = 'Больше нуля';
  }
  return errors;
}

function CalculationResult({ result, updating }: { result: ProfitCalculation; updating: boolean }) {
  const money = (quantity: number) => formatMoney({ quantity, currency: result.currency });
  const profitColor = result.profit >= 0 ? 'teal' : 'red';
  const taxed = result.taxRatePercent != null;

  return (
    <Stack gap="md" style={{ opacity: updating ? 0.6 : 1 }}>
      <SimpleGrid cols={{ base: 1, xs: 2, md: taxed ? 4 : 2 }}>
        <ResultStat
          label="Доход"
          value={money(result.profit)}
          hint={`${formatPercent(result.profitPercent)} за ${formatNumber(result.days)} ${plural(result.days, 'день', 'дня', 'дней')}`}
          color={profitColor}
        />
        <ResultStat label="В пересчёте на год" value={formatPercent(result.annualProfitPercent)} hint="без сложного процента" />
        {taxed && (
          <>
            <ResultStat
              label={`НДФЛ ${formatPercent(result.taxRatePercent)}`}
              value={money(result.tax)}
              hint="с положительного дохода"
            />
            <ResultStat
              label="Доход после налога"
              value={money(result.netProfit)}
              hint={formatPercent(result.netProfitPercent)}
              color={result.netProfit >= 0 ? 'teal' : 'red'}
            />
          </>
        )}
      </SimpleGrid>

      <Card withBorder padding="md">
        <Title order={4} mb="sm">
          Из чего складывается
        </Title>
        <Table>
          <Table.Tbody>
            <Row
              label={`Покупка ${formatNumber(result.quantity)} шт. по ${formatPercent(result.buyPricePercent)} · ${formatDate(result.buyDate)}`}
              value={-result.purchaseAmount}
              money={money}
            />
            <Row label="НКД продавцу при покупке" value={-result.purchaseAci} money={money} />
            <Row
              label={`Купоны: ${formatNumber(result.couponCount)} ${plural(result.couponCount, 'выплата', 'выплаты', 'выплат')}`}
              value={result.couponIncome}
              money={money}
            />
            {result.amortizationIncome > 0 && (
              <Row label="Частичные погашения номинала" value={result.amortizationIncome} money={money} />
            )}
            <Row
              label={`${EXIT_LABELS[result.exitType]} по ${formatPercent(result.sellPricePercent)} · ${formatDate(result.sellDate)}`}
              value={result.exitAmount}
              money={money}
            />
            {result.exitType !== 'MATURITY' && <Row label="НКД от покупателя при продаже" value={result.exitAci} money={money} />}
          </Table.Tbody>
        </Table>
      </Card>

      <Warnings result={result} />
    </Stack>
  );
}

function Row({ label, value, money }: { label: string; value: number; money: (value: number) => string }) {
  return (
    <Table.Tr>
      <Table.Td>{label}</Table.Td>
      <Table.Td ta="right" c={value < 0 ? 'red' : undefined}>
        {value > 0 ? `+${money(value)}` : money(value)}
      </Table.Td>
    </Table.Tr>
  );
}

function ResultStat({ label, value, hint, color }: { label: string; value: string; hint: string; color?: string }) {
  return (
    <Card withBorder padding="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={600} mt={4} c={color}>
        {value}
      </Text>
      <Text size="sm" c="dimmed">
        {hint}
      </Text>
    </Card>
  );
}

function Warnings({ result }: { result: ProfitCalculation }) {
  const warnings = [
    result.unknownCouponCount > 0 &&
      `Размер ${formatNumber(result.unknownCouponCount)} ${plural(result.unknownCouponCount, 'купона', 'купонов', 'купонов')} ещё не объявлен (переменный купон) - в доход они не вошли.`,
    result.aciUnknown && 'НКД при покупке или продаже не посчитать: размер текущего купона не объявлен - принят нулевым.',
    result.amortizationScheduleMissing &&
      'У облигации амортизация, но график погашений ещё не загружен - частичные погашения номинала не учтены.',
  ].filter(Boolean);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <Alert color="yellow" variant="light" icon={<IconAlertTriangle />} title="Расчёт неполный">
      <Stack gap={4}>
        {warnings.map((warning) => (
          <Text key={String(warning)} size="sm">
            {warning}
          </Text>
        ))}
      </Stack>
    </Alert>
  );
}
