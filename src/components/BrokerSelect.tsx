import { Select } from '@mantine/core';
import { useMemo, useState } from 'react';
import { MAX_BROKER_LENGTH } from '../api/portfolio';
import { useBrokers } from '../api/queries';

// значение пункта «Добавить»: его не спутать с именем брокера
const NEW_BROKER_PREFIX = '\u0000new:';

interface Props {
  /** Имя выбранного брокера; null - не указан */
  value: string | null;
  onChange: (broker: string | null) => void;
}

/**
 * Брокер покупки: выбор из уже заведённых или новый - набрать имя и выбрать «Добавить». Новый брокер сохраняется
 * на бэке вместе с покупкой и дальше есть в списке для следующих покупок.
 */
export function BrokerSelect({ value, onChange }: Props) {
  const brokers = useBrokers();
  const [search, setSearch] = useState(value ?? '');

  const names = useMemo(() => {
    const known = (brokers.data ?? []).map((broker) => broker.name);
    // новое имя ещё не сохранено - держим его в списке, иначе Select не покажет выбранное значение
    return value && !known.some((name) => name.toLowerCase() === value.toLowerCase()) ? [...known, value] : known;
  }, [brokers.data, value]);

  const typed = search.trim();
  const exists = names.some((name) => name.toLowerCase() === typed.toLowerCase());
  const canAdd = typed.length > 0 && typed.length <= MAX_BROKER_LENGTH && !exists && typed !== value;
  const data = canAdd ? [...names, { value: `${NEW_BROKER_PREFIX}${typed}`, label: `+ Добавить «${typed}»` }] : names;

  return (
    <Select
      label="Брокер"
      placeholder={names.length > 0 ? 'Выберите или введите нового' : 'Введите название брокера'}
      searchable
      clearable
      searchValue={search}
      onSearchChange={setSearch}
      value={value}
      data={data}
      // пункт «Добавить» виден всегда, остальные - по введённому тексту
      filter={({ options, search: query }) => {
        const needle = query.trim().toLowerCase();
        return options.filter(
          (option) =>
            'value' in option &&
            (option.value.startsWith(NEW_BROKER_PREFIX) || option.value === value || option.label.toLowerCase().includes(needle)),
        );
      }}
      nothingFoundMessage="Введите название брокера"
      onChange={(next) => {
        if (next?.startsWith(NEW_BROKER_PREFIX)) {
          const name = next.slice(NEW_BROKER_PREFIX.length);
          onChange(name);
          setSearch(name);
          return;
        }
        onChange(next);
      }}
    />
  );
}
