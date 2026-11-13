import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { fetchBond } from '../api/bonds';
import { MAX_BUY_PRICE, MAX_POSITION_QUANTITY } from '../api/portfolio';
import { bondKeys, useSaleMutations } from '../api/queries';
import type { PortfolioSaleRequest, PortfolioTrade } from '../api/types';
import { isIsoDate, todayIso } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { ApiErrorText } from './ApiErrorText';
import { BondSearch } from './BondSearch';
import { BrokerSelect } from './BrokerSelect';
import { NumberField } from './NumberField';

/** Облигация, которую продают из строки портфеля: сколько её есть и текущая цена */
export interface SaleBond {
  ticker: string;
  name: string | null;
  currentPrice: number | null;
  /** Сколько не продано - подсказка у количества */
  quantity: number | null;
}

/**
 * Новая продажа или изменение существующей. Цена по умолчанию - текущая; НКД и комиссия необязательны: без НКД он
 * считается по графику купонов, без комиссии - 0. Хватает ли облигаций на дату продажи, проверяет бэк (422).
 */
export function SaleForm({ sale, preset, onDone }: { sale?: PortfolioTrade; preset?: SaleBond; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { create, update } = useSaleMutations();
  const today = todayIso();
  const [ticker, setTicker] = useState<string | null>(sale?.ticker ?? preset?.ticker ?? null);
  const [tickerName, setTickerName] = useState<string | null>(preset?.name ?? null);
  const [quantity, setQuantity] = useState<number | undefined>(sale?.quantity ?? preset?.quantity ?? 1);
  const [sellPrice, setSellPrice] = useState<number | undefined>(sale?.price ?? preset?.currentPrice ?? undefined);
  const priceTouched = useRef(sale != null);
  const [sellDate, setSellDate] = useState(sale?.date ?? today);
  // НКД, посчитанный по графику, в форму не подставляется: его не вводили
  const [aci, setAci] = useState<number | undefined>(sale && !sale.aciCalculated ? (sale.aci ?? undefined) : undefined);
  const [commission, setCommission] = useState<number | undefined>(sale?.commission ?? undefined);
  const [broker, setBroker] = useState<string | null>(sale?.broker ?? null);
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    ticker: sale == null && !ticker ? 'Выберите облигацию' : undefined,
    quantity:
      quantity == null || quantity < 1 || quantity > MAX_POSITION_QUANTITY
        ? `От 1 до ${formatNumber(MAX_POSITION_QUANTITY)}`
        : undefined,
    sellPrice:
      sellPrice == null || sellPrice <= 0 || sellPrice > MAX_BUY_PRICE ? `Больше 0 и не выше ${MAX_BUY_PRICE} %` : undefined,
    sellDate: !isIsoDate(sellDate) ? 'Укажите дату' : sellDate > today ? 'Не позже сегодня' : undefined,
    aci: aci != null && aci < 0 ? 'Не меньше 0' : undefined,
    commission: commission != null && commission < 0 ? 'Не меньше 0' : undefined,
  };
  const valid = Object.values(errors).every((error) => error == null);
  const mutation = sale ? update : create;

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
          setSellPrice((value) => (priceTouched.current ? value : current));
        }
      })
      .catch(() => undefined);
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid || quantity == null || sellPrice == null) {
      return;
    }
    const request: PortfolioSaleRequest = { quantity, sellPrice, sellDate, broker: broker ?? '' };
    if (aci != null) {
      request.aci = aci;
    }
    if (commission != null) {
      request.commission = commission;
    }
    if (sale?.id != null) {
      update.mutate({ id: sale.id, ...request }, { onSuccess: onDone });
    } else {
      create.mutate({ ...request, ticker: ticker! }, { onSuccess: onDone });
    }
  };

  const shown = (error: string | undefined) => (submitted ? error : undefined);
  const fixedName = sale ? (sale.bondName ?? sale.ticker) : preset ? (preset.name ?? preset.ticker) : null;

  return (
    <Stack gap="md">
      {fixedName != null ? (
        <Text size="sm" c="dimmed">
          {fixedName}
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
        description={preset?.quantity != null ? `В портфеле ${formatNumber(preset.quantity)} шт.` : undefined}
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={MAX_POSITION_QUANTITY}
        allowDecimal={false}
        thousandSeparator=" "
        error={shown(errors.quantity)}
      />
      <NumberField
        label="Цена продажи, % номинала"
        description="Выкуп по оферте - 100"
        value={sellPrice}
        onChange={(value) => {
          priceTouched.current = true;
          setSellPrice(value);
        }}
        min={0}
        decimalScale={4}
        decimalSeparator=","
        error={shown(errors.sellPrice)}
      />
      <TextInput
        label="Дата продажи"
        type="date"
        value={sellDate}
        max={today}
        onChange={(event) => setSellDate(event.currentTarget.value)}
        error={shown(errors.sellDate)}
      />
      <NumberField
        label="НКД, полученный при продаже"
        description="На всю продажу, в валюте облигации. Пусто - по графику купонов"
        value={aci}
        onChange={setAci}
        min={0}
        decimalScale={2}
        decimalSeparator=","
        thousandSeparator=" "
        error={shown(errors.aci)}
      />
      <NumberField
        label="Комиссия брокера"
        description="В валюте облигации. Пусто - без комиссии"
        value={commission}
        onChange={setCommission}
        min={0}
        decimalScale={2}
        decimalSeparator=","
        thousandSeparator=" "
        error={shown(errors.commission)}
      />
      <BrokerSelect value={broker} onChange={setBroker} />
      {mutation.isError && <ApiErrorText error={mutation.error} />}
      <Group justify="flex-end">
        <Button variant="default" onClick={onDone}>
          Отмена
        </Button>
        <Button onClick={submit} loading={mutation.isPending}>
          {sale ? 'Сохранить' : 'Продать'}
        </Button>
      </Group>
    </Stack>
  );
}
