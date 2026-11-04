import { Group, Loader, Select, Stack, Text, type ComboboxItem } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { MIN_SEARCH_LENGTH, useBondSearch } from '../api/queries';
import type { BondSearchItem } from '../api/types';

/** Пауза после ввода, прежде чем искать: не дёргаем бэк на каждую букву */
export const SEARCH_DELAY_MS = 300;

interface Props {
  /** Тикер выбранной облигации */
  value: string | null;
  /** Название выбранной облигации - чтобы показать её, даже если её нет в последних подсказках */
  selectedName?: string | null;
  onChange: (ticker: string | null) => void;
}

interface Option extends ComboboxItem {
  bond?: BondSearchItem;
}

const label = (ticker: string, name: string | null | undefined) => (name ? `${ticker} — ${name}` : ticker);

/** Нестрогий поиск облигации по тикеру, ISIN или названию: подсказки приходят с бэка по мере ввода */
export function BondSearch({ value, selectedName, onChange }: Props) {
  const selectedLabel = value ? label(value, selectedName) : null;
  const [search, setSearch] = useState(selectedLabel ?? '');
  const [prevLabel, setPrevLabel] = useState(selectedLabel);

  // название выбранной облигации пришло позже тикера - обновляем подпись, если пользователь ещё ничего не набрал
  if (selectedLabel !== prevLabel) {
    setPrevLabel(selectedLabel);
    if (search === (prevLabel ?? '')) {
      setSearch(selectedLabel ?? '');
    }
  }
  // в поле стоит подпись выбранной облигации - искать по ней нечего
  const [query] = useDebouncedValue(search === selectedLabel ? '' : search, SEARCH_DELAY_MS);
  const result = useBondSearch(query);

  const options = useMemo<Option[]>(() => {
    const found: Option[] = (result.data ?? []).map((bond) => ({
      value: bond.ticker,
      label: label(bond.ticker, bond.name),
      bond,
    }));
    // выбранная облигация всегда среди вариантов, иначе Select не покажет её подпись
    return value && selectedLabel && !found.some((option) => option.value === value)
      ? [{ value, label: selectedLabel }, ...found]
      : found;
  }, [result.data, value, selectedLabel]);

  const tooShort = query.trim().length < MIN_SEARCH_LENGTH;

  return (
    <Select
      label="Облигация"
      placeholder="Тикер, ISIN или название"
      leftSection={<IconSearch size={16} />}
      rightSection={result.isFetching ? <Loader size="xs" /> : undefined}
      searchable
      clearable
      searchValue={search}
      onSearchChange={setSearch}
      value={value}
      onChange={(ticker) => onChange(ticker)}
      data={options}
      // варианты уже отобраны бэком
      filter={({ options: all }) => all}
      nothingFoundMessage={tooShort ? `Введите хотя бы ${MIN_SEARCH_LENGTH} символа` : 'Ничего не нашлось'}
      renderOption={({ option }) => <SearchOption option={option as Option} />}
      maxDropdownHeight={360}
      w="100%"
    />
  );
}

function SearchOption({ option }: { option: Option }) {
  const bond = option.bond;
  if (!bond) {
    return <Text size="sm">{option.label}</Text>;
  }

  return (
    <Stack gap={0}>
      <Text size="sm">{bond.name ?? bond.ticker}</Text>
      <Group gap="xs">
        <Text size="xs" c="dimmed">
          {bond.ticker}
        </Text>
        {bond.isin && bond.isin !== bond.ticker && (
          <Text size="xs" c="dimmed">
            ISIN {bond.isin}
          </Text>
        )}
        {bond.currency && (
          <Text size="xs" c="dimmed">
            {bond.currency.toUpperCase()}
          </Text>
        )}
      </Group>
    </Stack>
  );
}
