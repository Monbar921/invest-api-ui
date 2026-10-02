import { parseBondSearch, toBondParameters, toSearchParams } from './bondSearchParams';

describe('bondSearchParams', () => {
  it('без параметров - умолчания как на бэке', () => {
    const state = parseBondSearch(new URLSearchParams());

    expect(state).toMatchObject({
      scope: 'all',
      page: 1,
      size: 50,
      sortField: 'PRICE',
      sortOrder: 'ASC',
      riskLevels: [],
      ofz: 'any',
    });
    expect(toSearchParams(state).toString()).toBe('');
  });

  it('разбирает и собирает все параметры без потерь', () => {
    const url =
      'scope=local&page=3&size=100&sort=COUPON_INTEREST%3ADESC&priceMin=900&priceMax=1000.5&percentMax=99&risk=RISK_LEVEL_LOW%2CRISK_LEVEL_HIGH&ofz=exclude';

    const state = parseBondSearch(new URLSearchParams(url));

    expect(state).toEqual({
      scope: 'local',
      page: 3,
      size: 100,
      sortField: 'COUPON_INTEREST',
      sortOrder: 'DESC',
      priceMin: 900,
      priceMax: 1000.5,
      percentMin: undefined,
      percentMax: 99,
      riskLevels: ['RISK_LEVEL_LOW', 'RISK_LEVEL_HIGH'],
      ofz: 'exclude',
    });
    expect(toSearchParams(state).toString()).toBe(url);
  });

  it('мусор в URL заменяется умолчаниями', () => {
    const state = parseBondSearch(
      new URLSearchParams('scope=crypto&page=-2&size=7&sort=PRICE:UP&priceMin=abc&risk=RISK_LEVEL_UNSPECIFIED,foo&ofz=1'),
    );

    expect(state).toMatchObject({
      scope: 'all',
      page: 1,
      size: 50,
      sortField: 'PRICE',
      sortOrder: 'ASC',
      priceMin: undefined,
      riskLevels: [],
      ofz: 'any',
    });
  });

  it('собирает тело запроса: пустые фильтры не отправляются', () => {
    const empty = toBondParameters(parseBondSearch(new URLSearchParams()));
    const filtered = toBondParameters(
      parseBondSearch(new URLSearchParams('priceMax=1000&risk=RISK_LEVEL_LOW&ofz=only&sort=TICKER:DESC')),
    );

    expect(empty).toEqual({ bondSorts: [{ sortField: 'PRICE', sortOrder: 'ASC' }] });
    expect(JSON.parse(JSON.stringify(filtered))).toEqual({
      bondSorts: [{ sortField: 'TICKER', sortOrder: 'DESC' }],
      currentPrice: { max: 1000 },
      riskLevels: ['RISK_LEVEL_LOW'],
      isOfz: true,
    });
  });
});
