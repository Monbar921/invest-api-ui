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
