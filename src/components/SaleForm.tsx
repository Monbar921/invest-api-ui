import { Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { MAX_BUY_PRICE, MAX_POSITION_QUANTITY } from '../api/portfolio';
import { useSaleMutations } from '../api/queries';
import type { PortfolioSaleRequest, PortfolioTrade } from '../api/types';
import { isIsoDate, todayIso } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { ApiErrorText } from './ApiErrorText';
import { BrokerSelect } from './BrokerSelect';
import { NumberField } from './NumberField';

/** Облигация, которую можно продать: сколько её есть и текущая цена */
export interface SaleBond {
  ticker: string;
  name: string | null;
  currentPrice: number | null;
  /** Сколько не продано - подсказка у количества */
  quantity: number | null;
}

/**
 * Новая продажа или изменение существующей. Облигация - заданная (из строки портфеля) или выбор из тех, что есть в
 * портфеле (holdings): продать можно только то, что куплено. Цена по умолчанию - текущая; НКД и комиссия
 * необязательны: без НКД он считается по графику купонов, без комиссии - 0. Хватает ли облигаций на дату продажи,
 * проверяет бэк (422); его ошибка пропадает, как только поле изменили.
 */
export function SaleForm({
  sale,
  preset,
  holdings = [],
  onDone,
}: {
  sale?: PortfolioTrade;
  preset?: SaleBond;
  holdings?: SaleBond[];
  onDone: () => void;
}) {
  const { create, update } = useSaleMutations();
  const mutation = sale ? update : create;
  const today = todayIso();
  const [ticker, setTicker] = useState<string | null>(sale?.ticker ?? preset?.ticker ?? null);
  const [quantity, setQuantity] = useState<number | undefined>(sale?.quantity ?? preset?.quantity ?? 1);
  const [sellPrice, setSellPrice] = useState<number | undefined>(sale?.price ?? preset?.currentPrice ?? undefined);
  // пользователь ввёл свою цену - выбор облигации её не затирает
  const [priceTouched, setPriceTouched] = useState(sale != null);
  const [sellDate, setSellDate] = useState(sale?.date ?? today);
  // НКД, посчитанный по графику, в форму не подставляется: его не вводили
  const [aci, setAci] = useState<number | undefined>(sale && !sale.aciCalculated ? (sale.aci ?? undefined) : undefined);
  const [commission, setCommission] = useState<number | undefined>(sale?.commission ?? undefined);
  const [broker, setBroker] = useState<string | null>(sale?.broker ?? null);
  const [submitted, setSubmitted] = useState(false);
  const selected = preset ?? holdings.find((holding) => holding.ticker === ticker) ?? null;

  /** Ответ бэка относится к прежним значениям - после правки поля он больше не верен */
  const changed =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      if (mutation.isError) {
        mutation.reset();
      }
      set(value);
    };

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

  const onTickerChange = (next: string | null) => {
    setTicker(next);
    const holding = holdings.find((item) => item.ticker === next);
    if (holding) {
      // по умолчанию - всё, что есть, по текущей цене, пока пользователь не ввёл свою
      setQuantity(holding.quantity ?? 1);
      if (holding.currentPrice != null && !priceTouched) {
        setSellPrice(holding.currentPrice);
      }
    }
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
        <Select
          label="Облигация"
          placeholder={holdings.length > 0 ? 'Из портфеля' : 'В портфеле нет облигаций для продажи'}
          data={holdings.map((holding) => ({ value: holding.ticker, label: holding.name ?? holding.ticker }))}
          value={ticker}
          onChange={changed(onTickerChange)}
          searchable
          disabled={holdings.length === 0}
          nothingFoundMessage="Нет в портфеле"
          error={shown(errors.ticker)}
        />
      )}
      <NumberField
        label="Количество, шт."
        description={selected?.quantity != null ? `В портфеле ${formatNumber(selected.quantity)} шт.` : undefined}
        value={quantity}
        onChange={changed(setQuantity)}
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
        onChange={changed((value: number | undefined) => {
          setPriceTouched(true);
          setSellPrice(value);
        })}
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
        onChange={(event) => changed(setSellDate)(event.currentTarget.value)}
        error={shown(errors.sellDate)}
      />
      <NumberField
        label="НКД, полученный при продаже"
        description="На всю продажу, в валюте облигации. Пусто - по графику купонов"
        value={aci}
        onChange={changed(setAci)}
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
        onChange={changed(setCommission)}
        min={0}
        decimalScale={2}
        decimalSeparator=","
        thousandSeparator=" "
        error={shown(errors.commission)}
      />
      <BrokerSelect value={broker} onChange={changed(setBroker)} />
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
