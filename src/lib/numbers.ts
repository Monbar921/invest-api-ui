/** Дробную часть можно отделить и запятой, и точкой - в поле показывается запятая */
export const DECIMAL_SEPARATORS = ['.', ','];

/**
 * Число из того, что набрано в NumberInput: пока число не дописано («79,», «-», «0,»), он отдаёт строку. «79,» - это
 * 79, а не пусто; строка без числа - undefined. Пробелы (разделитель тысяч) не мешают.
 */
export function parseDraft(draft: number | string): number | undefined {
  if (typeof draft === 'number') {
    return draft;
  }
  const normalized = draft.replace(/\s/g, '').replace(',', '.');
  const digits = normalized.endsWith('.') ? normalized.slice(0, -1) : normalized;
  if (digits === '' || digits === '-') {
    return undefined;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}
