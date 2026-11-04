import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { calculateProfit, fetchBond, fetchBondsPage, fetchCandles, searchBonds } from './bonds';
import { ApiError } from './client';
import type { BondParameters, BondScope, CandleInterval, ProfitCalculationRequest } from './types';

export const bondKeys = {
  all: ['bonds'] as const,
  page: (scope: BondScope, page: number, size: number, parameters: BondParameters) =>
    [...bondKeys.all, 'page', scope, page, size, parameters] as const,
  detail: (ticker: string) => [...bondKeys.all, 'detail', ticker] as const,
  search: (query: string) => [...bondKeys.all, 'search', query] as const,
  calculation: (ticker: string, parameters: ProfitCalculationRequest) =>
    [...bondKeys.all, 'calculation', ticker, parameters] as const,
  candles: (ticker: string, interval: CandleInterval, from: string | undefined) =>
    [...bondKeys.all, 'candles', ticker, interval, from ?? 'all'] as const,
};

/** Как и на бэке: запрос короче двух символов ничего не ищет */
export const MIN_SEARCH_LENGTH = 2;

export function useBondsPage(scope: BondScope, page: number, size: number, parameters: BondParameters) {
  return useQuery({
    queryKey: bondKeys.page(scope, page, size, parameters),
    queryFn: () => fetchBondsPage(scope, page, size, parameters),
    // при смене страницы или фильтра таблица показывает прежние строки, пока грузятся новые
    placeholderData: keepPreviousData,
  });
}

export function useBond(ticker: string) {
  return useQuery({
    queryKey: bondKeys.detail(ticker),
    queryFn: () => fetchBond(ticker),
    // 404 повторять бессмысленно
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}

export function useBondSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: bondKeys.search(trimmed),
    queryFn: () => searchBonds(trimmed),
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
    // пока ищется новый запрос, список подсказок не пропадает
    placeholderData: keepPreviousData,
  });
}

export function useProfitCalculation(ticker: string, parameters: ProfitCalculationRequest, enabled: boolean) {
  return useQuery({
    queryKey: bondKeys.calculation(ticker, parameters),
    queryFn: () => calculateProfit(ticker, parameters),
    enabled,
    placeholderData: keepPreviousData,
    // 422 - параметры не подходят облигации, повтор не поможет
    retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
  });
}

export function useBondCandles(ticker: string, interval: CandleInterval, from: string | undefined) {
  return useQuery({
    queryKey: bondKeys.candles(ticker, interval, from),
    queryFn: () => fetchCandles(ticker, interval, from),
    // при смене интервала или периода график не пропадает, пока грузится новый
    placeholderData: keepPreviousData,
    // свечи обновляются раз в сутки ночной синхронизацией
    staleTime: 5 * 60 * 1000,
  });
}
