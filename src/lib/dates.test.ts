import { addMonths, isIsoDate, periodStart, todayIso, toIsoDate } from './dates';

describe('dates', () => {
  it('сегодня по местному времени в YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('дата из ISO-строки бэка', () => {
    expect(toIsoDate('2029-03-14T00:00:00Z')).toBe('2029-03-14');
    expect(toIsoDate(null)).toBeNull();
    expect(isIsoDate('2029-03-14')).toBe(true);
    expect(isIsoDate('14.03.2029')).toBe(false);
  });

  it('начало периода графика', () => {
    expect(periodStart('1M', '2026-11-04')).toBe('2026-10-04');
    expect(periodStart('6M', '2026-11-04')).toBe('2026-05-04');
    expect(periodStart('1Y', '2026-11-04')).toBe('2025-11-04');
    expect(periodStart('3Y', '2026-11-04')).toBe('2023-11-04');
    expect(periodStart('ALL', '2026-11-04')).toBeUndefined();
  });

  it('в коротком месяце - его последний день', () => {
    expect(periodStart('1M', '2026-03-31')).toBe('2026-02-28');
    expect(periodStart('1M', '2028-03-31')).toBe('2028-02-29');
    expect(periodStart('1M', '2026-01-15')).toBe('2025-12-15');
  });
});

describe('addMonths', () => {
  it('сдвигает дату вперёд на месяцы', () => {
    expect(addMonths('2026-11-12', 3)).toBe('2027-02-12');
    expect(addMonths('2026-11-12', 12)).toBe('2027-11-12');
  });

  it('31-е число в коротком месяце - его последний день', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29');
  });
});
