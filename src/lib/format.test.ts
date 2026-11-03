import {
  couponTypeLabel,
  formatDate,
  formatMoney,
  formatPercent,
  formatRub,
  formatTimeToMaturity,
  isRubCurrency,
} from './format';

// Intl в ru-RU разделяет разряды неразрывным пробелом
const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('format', () => {
  it('деньги: код валюты в нижнем регистре, неизвестная валюта, нет суммы', () => {
    expect(normalize(formatMoney({ quantity: 1005.5, currency: 'rub' }))).toBe('1 005,50 ₽');
    expect(normalize(formatMoney({ quantity: 980, currency: 'usd' }))).toBe('980,00 $');
    expect(normalize(formatMoney({ quantity: 771, currency: 'cny' }))).toBe('771,00 ¥');
    expect(normalize(formatMoney({ quantity: 10, currency: 'xx' }))).toBe('10 XX');
    expect(formatMoney({ quantity: null, currency: 'rub' })).toBe('—');
    expect(formatMoney(null)).toBe('—');
  });

  it('рубли и код рублёвой валюты', () => {
    expect(normalize(formatRub(88200))).toBe('88 200,00 ₽');
    expect(formatRub(null)).toBe('—');
    expect(isRubCurrency('rub')).toBe(true);
    expect(isRubCurrency('RUR')).toBe(true);
    expect(isRubCurrency('usd')).toBe(false);
    expect(isRubCurrency(null)).toBe(false);
  });

  it('проценты и даты', () => {
    expect(normalize(formatPercent(98.9474))).toBe('98,95 %');
    expect(formatPercent(null)).toBe('—');
    expect(formatDate('2029-03-14T00:00:00')).toBe('14.03.2029');
    expect(formatDate('не дата')).toBe('—');
  });

  it('срок до погашения', () => {
    const now = new Date('2026-10-01T12:00:00');

    expect(formatTimeToMaturity('2026-10-02T12:00:00', now)).toBe('через 1 день');
    expect(formatTimeToMaturity('2026-10-04T12:00:00', now)).toBe('через 3 дня');
    expect(formatTimeToMaturity('2026-11-15T12:00:00', now)).toBe('через 45 дней');
    expect(formatTimeToMaturity('2029-03-01T12:00:00', now)).toBe('через 2,4 года');
    expect(formatTimeToMaturity('2029-10-01T12:00:00', now)).toBe('через 3 года');
    expect(formatTimeToMaturity('2038-12-15T00:00:00', now)).toBe('через 12,2 года');
    expect(formatTimeToMaturity('2041-05-15T00:00:00', now)).toBe('через 14,6 года');
    expect(formatTimeToMaturity('2026-09-01T00:00:00', now)).toBe('погашена');
  });
});

describe('couponTypeLabel', () => {
  it('постоянный, переменный или неизвестный купон', () => {
    expect(couponTypeLabel(true)).toBe('постоянный');
    expect(couponTypeLabel(false)).toBe('переменный');
    expect(couponTypeLabel(null)).toBeNull();
  });
});
