import { parseDraft } from './numbers';

describe('parseDraft', () => {
  it('число - как есть', () => {
    expect(parseDraft(95.499)).toBe(95.499);
  });

  it('недописанная дробь - целая часть, а не пусто', () => {
    expect(parseDraft('79,')).toBe(79);
    expect(parseDraft('79.')).toBe(79);
    expect(parseDraft('0,')).toBe(0);
  });

  it('запятая и точка', () => {
    expect(parseDraft('95,49')).toBe(95.49);
    expect(parseDraft('95.49')).toBe(95.49);
  });

  it('разделитель тысяч', () => {
    expect(parseDraft('76 900,5')).toBe(76900.5);
    expect(parseDraft('76 900')).toBe(76900);
  });

  it('пусто и не число - undefined', () => {
    expect(parseDraft('')).toBeUndefined();
    expect(parseDraft('-')).toBeUndefined();
    expect(parseDraft(',')).toBeUndefined();
  });
});
