// Даты калькулятора - строки YYYY-MM-DD: в таком виде их принимает <input type="date"> и бэк (LocalDate)

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Сегодняшняя дата по местному времени */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Дата из ISO-строки бэка («2029-03-14T00:00:00Z»); null - даты нет */
export function toIsoDate(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

/** Период графика цены: месяц, полгода, год, три года, вся история */
export type ChartPeriod = '1M' | '6M' | '1Y' | '3Y' | 'ALL';

const PERIOD_MONTHS: Record<ChartPeriod, number | undefined> = { '1M': 1, '6M': 6, '1Y': 12, '3Y': 36, ALL: undefined };

/** Первый день периода (YYYY-MM-DD), считая назад от today; «Всё» - без ограничения */
export function periodStart(period: ChartPeriod, today: string = todayIso()): string | undefined {
  const months = PERIOD_MONTHS[period];
  if (!months) {
    return undefined;
  }
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  // 31 марта минус месяц - 28 (29) февраля, а не 3 марта, как дал бы setMonth
  const lastDay = new Date(year, month - 1 - months + 1, 0).getDate();
  return todayIso(new Date(year, month - 1 - months, Math.min(day, lastDay)));
}
