import { NumberInput, type NumberInputProps } from '@mantine/core';
import { useState } from 'react';
import { DECIMAL_SEPARATORS, parseDraft } from '../lib/numbers';

interface Props extends Omit<NumberInputProps, 'value' | 'onChange'> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}

type Draft = number | string;

/**
 * Поле ввода числа: держит набранный текст, пока число не дописано, - иначе запятая или точка в «79,» стирала бы
 * всё поле (NumberInput отдаёт такую строку, а не число). Наружу - уже число или undefined. Дробную часть можно
 * отделить и запятой, и точкой.
 */
export function NumberField({ value, onChange, ...props }: Props) {
  const [draft, setDraft] = useState<Draft>(value ?? '');
  const [prevValue, setPrevValue] = useState(value);

  // значение сменилось снаружи (подставили текущую цену) - показываем его, если набранное означает другое число
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseDraft(draft) !== value) {
      setDraft(value ?? '');
    }
  }

  return (
    <NumberInput
      decimalSeparator=","
      allowedDecimalSeparators={DECIMAL_SEPARATORS}
      {...props}
      value={draft}
      onChange={(next) => {
        const parsed = parseDraft(next);
        setDraft(next);
        setPrevValue(parsed);
        onChange(parsed);
      }}
    />
  );
}
