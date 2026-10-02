import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchBond, fetchBondsPage } from './bonds';
import { ApiError } from './client';
import type { BondParameters, BondScope } from './types';

export const bondKeys = {
  all: ['bonds'] as const,
  page: (scope: BondScope, page: number, size: number, parameters: BondParameters) =>
    [...bondKeys.all, 'page', scope, page, size, parameters] as const,
  detail: (ticker: string) => [...bondKeys.all, 'detail', ticker] as const,
};

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
