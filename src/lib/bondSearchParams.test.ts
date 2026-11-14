import { hasScreenerFilters, parseBondSearch, toBondParameters, toSearchParams } from './bondSearchParams';

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
      couponType: 'any',
    });
    expect(toSearchParams(state).toString()).toBe('');
  });

  it('разбирает и собирает все параметры без потерь', () => {
    const url =
      'scope=local&page=3&size=100&sort=COUPON_INTEREST%3ADESC&priceMin=900&priceMax=1000.5&percentMax=99&risk=RISK_LEVEL_LOW%2CRISK_LEVEL_HIGH&ofz=exclude&coupon=floating';

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
      couponType: 'floating',
      sectors: [],
      frequencies: [],
      offer: 'any',
      amortization: 'any',
    });
    expect(toSearchParams(state).toString()).toBe(url);
  });

  it('фильтры скринера: разбирает, собирает и отправляет', () => {
    const url =
      'sort=CREDIT_RATING%3ADESC&sector=financial%2Cgovernment&yearsMin=1&yearsMax=3&freq=4%2C12&offer=without&amort=with' +
      '&ratingMin=BBB-&durMax=2.5&ytmMin=15&turnoverMin=1000000&spreadMin=-0.5&spreadMax=4';

    const state = parseBondSearch(new URLSearchParams(url));

    expect(state).toMatchObject({
      sortField: 'CREDIT_RATING',
      sectors: ['financial', 'government'],
      yearsMin: 1,
      yearsMax: 3,
      frequencies: [4, 12],
      offer: 'without',
      amortization: 'with',
      ratingMin: 'BBB-',
      durationMax: 2.5,
      ytmMin: 15,
      turnoverMin: 1000000,
      spreadMin: -0.5,
      spreadMax: 4,
    });
    expect(toSearchParams(state).toString()).toBe(url);
    expect(hasScreenerFilters(state)).toBe(true);
    expect(JSON.parse(JSON.stringify(toBondParameters(state)))).toEqual({
      bondSorts: [{ sortField: 'CREDIT_RATING', sortOrder: 'DESC' }],
      sectors: ['financial', 'government'],
      yearsToMaturity: { min: 1, max: 3 },
      couponFrequencies: [4, 12],
      hasOffer: false,
      hasAmortization: true,
      creditRating: { min: 'BBB-' },
      duration: { max: 2.5 },
      yieldToMaturity: { min: 15 },
      avgDailyTurnover: { min: 1000000 },
      spreadToOfz: { min: -0.5, max: 4 },
    });
  });

  it('неизвестные рейтинг, частота и сектор в URL отбрасываются', () => {
    const state = parseBondSearch(new URLSearchParams('ratingMin=Z&freq=3,abc,12&sector=Fin;drop&offer=maybe'));

    expect(state.ratingMin).toBeUndefined();
    expect(state.frequencies).toEqual([12]);
    expect(state.sectors).toEqual([]);
    expect(state.offer).toBe('any');
    expect(hasScreenerFilters(parseBondSearch(new URLSearchParams('priceMax=10')))).toBe(false);
  });

  it('мусор в URL заменяется умолчаниями', () => {
    const state = parseBondSearch(
      new URLSearchParams(
        'scope=crypto&page=-2&size=7&sort=PRICE:UP&priceMin=abc&risk=RISK_LEVEL_UNSPECIFIED,foo&ofz=1&coupon=zero',
      ),
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
      couponType: 'any',
    });
  });

  it('собирает тело запроса: пустые фильтры не отправляются', () => {
    const empty = toBondParameters(parseBondSearch(new URLSearchParams()));
    const filtered = toBondParameters(
      parseBondSearch(new URLSearchParams('priceMax=1000&risk=RISK_LEVEL_LOW&ofz=only&coupon=fixed&sort=TICKER:DESC')),
    );

    expect(empty).toEqual({ bondSorts: [{ sortField: 'PRICE', sortOrder: 'ASC' }] });
    expect(JSON.parse(JSON.stringify(filtered))).toEqual({
      bondSorts: [{ sortField: 'TICKER', sortOrder: 'DESC' }],
      currentPrice: { max: 1000 },
      riskLevels: ['RISK_LEVEL_LOW'],
      isOfz: true,
      isFixedCoupon: true,
    });
  });
});
