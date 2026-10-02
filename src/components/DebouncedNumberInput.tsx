import { NumberInput, type NumberInputProps } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { useState } from 'react';

interface Props extends Omit<NumberInputProps, 'value' | 'onChange'> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  delay?: number;
}

type Draft = number | string;

const toValue = (draft: Draft): number | undefined => (typeof draft === 'number' ? draft : undefined);

/** Поле ввода числа, которое отдаёт значение после паузы в наборе - не дёргает запрос на каждую цифру */
export function DebouncedNumberInput({ value, onChange, delay = 400, ...props }: Props) {
  const [draft, setDraft] = useState<Draft>(value ?? '');
  const [prevValue, setPrevValue] = useState(value);

  // значение сменилось снаружи (сброс фильтров, «Назад» в браузере) - показываем его, если оно не совпадает с набранным
  if (value !== prevValue) {
    setPrevValue(value);
    if (toValue(draft) !== value) {
      setDraft(value ?? '');
    }
  }

  const commit = useDebouncedCallback((next: Draft) => {
    // строка кроме пустой - недописанное число («1,», «-»): ждём, пока допишут
    if (typeof next === 'number' || next === '') {
      onChange(toValue(next));
    }
  }, delay);

  return (
    <NumberInput
      {...props}
      value={draft}
      onChange={(next) => {
        setDraft(next);
        commit(next);
      }}
    />
  );
}
