import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  calculateProfit,
  fetchBond,
  fetchBondEvents,
  fetchBondNews,
  fetchBondsPage,
  fetchBrokerLinks,
  fetchCandles,
  fetchCollection,
  fetchCollections,
  fetchIssuer,
  fetchIssuerNews,
  fetchMarketOverview,
  fetchNews,
  registerBrokerClick,
  searchBonds,
} from './bonds';
import { trackGoal } from '../lib/analytics';
import { cancelAutoRenewal, createPayment, fetchAccountPlan, fetchPayment, fetchPayments } from './account';
import { ApiError } from './client';
import { useSession } from './session';
import {
  type AlertChanges,
  type AlertRule,
  createAlert,
  deleteAlert,
  fetchAlerts,
  fetchNotifications,
  updateAlert,
} from './alerts';
import {
  createCalendarLink,
  createPosition,
  deleteCalendarLink,
  deletePosition,
  fetchBrokers,
  fetchCalendarLink,
  fetchPortfolio,
  fetchPortfolioCalendar,
  updatePosition,
} from './portfolio';
import { createTelegramLink, fetchTelegramStatus, unlinkTelegram } from './telegram';
import type {
  BondParameters,
  BondScope,
  CandleInterval,
  NewsSource,
  Page,
  PortfolioPositionRequest,
  ProfitCalculationRequest,
} from './types';

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
  events: (ticker: string) => [...bondKeys.all, 'events', ticker] as const,
  bondNews: (ticker: string) => [...bondKeys.all, 'news', ticker] as const,
  brokerLinks: (ticker: string) => [...bondKeys.all, 'broker-links', ticker] as const,
  issuer: (id: number) => [...bondKeys.all, 'issuer', id] as const,
  issuerNews: (id: number) => [...bondKeys.all, 'issuer', id, 'news'] as const,
  collections: () => [...bondKeys.all, 'collections'] as const,
  collection: (slug: string, page: number, size: number) => [...bondKeys.all, 'collection', slug, page, size] as const,
};

export const newsKeys = {
  all: ['news'] as const,
  feed: (sources: NewsSource[]) => [...newsKeys.all, 'feed', ...sources] as const,
  overview: () => [...newsKeys.all, 'overview'] as const,
};

/** Сколько новостей подгружать за раз */
export const NEWS_PAGE_SIZE = 20;
// новости загружаются на бэке раз в 15 минут
const NEWS_STALE_TIME = 5 * 60 * 1000;

const nextNewsPage = (last: Page<unknown>) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined);

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

const notFoundNoRetry = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status === 404) && failureCount < 2;

export function useIssuer(id: number) {
  return useQuery({
    queryKey: bondKeys.issuer(id),
    queryFn: () => fetchIssuer(id),
    enabled: Number.isInteger(id) && id > 0,
    retry: notFoundNoRetry,
  });
}

export function useIssuerNews(id: number) {
  return useInfiniteQuery({
    queryKey: bondKeys.issuerNews(id),
    queryFn: ({ pageParam }) => fetchIssuerNews(id, pageParam, NEWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
    staleTime: NEWS_STALE_TIME,
    enabled: Number.isInteger(id) && id > 0,
  });
}

/** Подборки меняются только с выкладкой бэка */
export function useCollections() {
  return useQuery({ queryKey: bondKeys.collections(), queryFn: fetchCollections, staleTime: Infinity });
}

export function useCollection(slug: string, page: number, size: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: bondKeys.collection(slug, page, size),
    queryFn: () => fetchCollection(slug, page, size),
    enabled,
    placeholderData: keepPreviousData,
    retry: notFoundNoRetry,
  });
}

/** Партнёры меняются только с настройкой бэка; ошибку не повторяем - блок рекламы просто не показывается */
export function useBrokerLinks(ticker: string) {
  return useQuery({
    queryKey: bondKeys.brokerLinks(ticker),
    queryFn: () => fetchBrokerLinks(ticker),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

/** Клик по ссылке партнёра; сбой учёта не мешает переходу и пользователю не показывается */
export function useBrokerClick(ticker: string) {
  return useMutation({ mutationFn: (partnerId: string) => registerBrokerClick(ticker, partnerId) });
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

/** Лента новостей с подгрузкой по кнопке «Показать ещё» */
export function useNewsFeed(sources: NewsSource[]) {
  return useInfiniteQuery({
    queryKey: newsKeys.feed(sources),
    queryFn: ({ pageParam }) => fetchNews(sources, pageParam, NEWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
    staleTime: NEWS_STALE_TIME,
  });
}

export function useBondNews(ticker: string) {
  return useInfiniteQuery({
    queryKey: bondKeys.bondNews(ticker),
    queryFn: ({ pageParam }) => fetchBondNews(ticker, pageParam, NEWS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
    staleTime: NEWS_STALE_TIME,
  });
}

export function useMarketOverview() {
  return useQuery({
    queryKey: newsKeys.overview(),
    queryFn: fetchMarketOverview,
    // курс ЦБ меняется раз в день, ставка - несколько раз в год
    staleTime: 30 * 60 * 1000,
  });
}

export function useBondEvents(ticker: string) {
  return useQuery({
    queryKey: bondKeys.events(ticker),
    queryFn: () => fetchBondEvents(ticker),
    staleTime: NEWS_STALE_TIME,
  });
}

export const telegramKeys = {
  status: ['telegram', 'status'] as const,
};

/** Пока пользователь открывает ссылку в Telegram, статус опрашивается - привязка появится после /start в боте */
const TELEGRAM_LINK_POLL_INTERVAL = 3000;

/**
 * Статус Telegram. Запрашивается только когда открыта панель (enabled), а пока ждём привязку - каждые 3 секунды.
 */
export function useTelegramStatus(enabled: boolean, waitingForLink: boolean) {
  const { authenticated } = useSession();
  return useQuery({
    queryKey: telegramKeys.status,
    queryFn: fetchTelegramStatus,
    enabled: enabled && authenticated,
    refetchInterval: (query) => (waitingForLink && query.state.data?.linked !== true ? TELEGRAM_LINK_POLL_INTERVAL : false),
  });
}

export function useCreateTelegramLink() {
  return useMutation({ mutationFn: createTelegramLink });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: telegramKeys.status }),
  });
}

export const accountKeys = {
  plan: ['account', 'plan'] as const,
  payments: ['account', 'payments'] as const,
  payment: (id: number) => ['account', 'payments', id] as const,
};

/** Тариф пользователя; лимиты и их использование меняются вместе с правилами и покупками - их мутации его сбрасывают */
export function useAccountPlan() {
  const { authenticated } = useSession();
  return useQuery({ queryKey: accountKeys.plan, queryFn: fetchAccountPlan, enabled: authenticated });
}

/** История платежей */
export function usePayments(enabled: boolean) {
  return useQuery({ queryKey: accountKeys.payments, queryFn: fetchPayments, enabled });
}

/** Сколько ждать оплату после возврата со страницы Т-Кассы, опрашивая статус */
export const PAYMENT_POLL_INTERVAL_MS = 3000;
const PAYMENT_POLL_ATTEMPTS = 40;

/**
 * Платёж, с оплаты которого вернулся пользователь (?payment=id). Пока ждёт оплаты - опрос раз в 3 секунды (бэк
 * уточняет статус у провайдера, если webhook ещё не пришёл), около двух минут. Итог сбрасывает тариф и историю.
 */
export function usePaymentStatus(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: accountKeys.payment(id ?? 0),
    queryFn: async () => {
      const payment = await fetchPayment(id!);
      if (payment.status !== 'PENDING') {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: accountKeys.plan }),
          queryClient.invalidateQueries({ queryKey: accountKeys.payments, exact: true }),
        ]);
      }
      return payment;
    },
    enabled: id != null,
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' && query.state.dataUpdateCount < PAYMENT_POLL_ATTEMPTS
        ? PAYMENT_POLL_INTERVAL_MS
        : false,
  });
}

/** Покупка тарифа и отмена автопродления */
export function usePaymentMutations() {
  const queryClient = useQueryClient();
  return {
    purchase: useMutation({ mutationFn: createPayment }),
    cancelAutoRenewal: useMutation({
      mutationFn: cancelAutoRenewal,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.plan }),
    }),
  };
}

export const alertKeys = {
  all: ['alerts'] as const,
  list: () => [...alertKeys.all, 'list'] as const,
  notifications: () => [...alertKeys.all, 'notifications'] as const,
};

/** Сколько уведомлений истории подгружать за раз */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Все правила пользователя одним запросом: и колокольчики в таблице, и диалог облигации, и страница уведомлений
 * берут их отсюда - таблица на 50 строк не делает 50 запросов.
 */
export function useAlerts() {
  // у гостя правил нет: без сессии gateway ответил бы 401
  const { authenticated } = useSession();
  return useQuery({ queryKey: alertKeys.list(), queryFn: fetchAlerts, enabled: authenticated });
}

export function useNotifications() {
  const { authenticated } = useSession();
  return useInfiniteQuery({
    enabled: authenticated,
    queryKey: alertKeys.notifications(),
    queryFn: ({ pageParam }) => fetchNotifications(pageParam, NOTIFICATIONS_PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: nextNewsPage,
  });
}

/** Создание, изменение и удаление правила; после - список правил и история перечитываются */
export function useAlertMutations() {
  const queryClient = useQueryClient();
  // правило могло сразу поставить уведомление в очередь - история тоже меняется; использование лимита тарифа - тоже
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: alertKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountKeys.plan }),
    ]);
  return {
    create: useMutation({
      mutationFn: (rule: AlertRule) => createAlert(rule),
      onSuccess: (_alert, rule) => {
        trackGoal('alert_rule_created', { type: rule.type });
        return onSuccess();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, ...changes }: AlertChanges & { id: number }) => updateAlert(id, changes),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: deleteAlert, onSuccess }),
  };
}

export const portfolioKeys = {
  all: ['portfolio'] as const,
  positions: () => [...portfolioKeys.all, 'positions'] as const,
  brokers: () => [...portfolioKeys.all, 'brokers'] as const,
  // внутри portfolioKeys.all: изменение покупок перечитывает и календарь
  calendar: (to: string) => [...portfolioKeys.all, 'calendar', to] as const,
  calendarLink: () => [...portfolioKeys.all, 'calendar-link'] as const,
};

/** Портфель с текущими ценами; цены на бэке обновляются в течение дня - перечитываем при возврате на вкладку */
export function usePortfolio() {
  const { authenticated } = useSession();
  return useQuery({ queryKey: portfolioKeys.positions(), queryFn: fetchPortfolio, enabled: authenticated });
}

export function useBrokers() {
  const { authenticated } = useSession();
  return useQuery({ queryKey: portfolioKeys.brokers(), queryFn: fetchBrokers, enabled: authenticated });
}

/**
 * Добавление, изменение и удаление покупки; после - портфель перечитывается (итоги считает бэк), а с ним и брокеры:
 * покупка с новым именем брокера его создаёт
 */
export function usePortfolioMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: portfolioKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountKeys.plan }),
    ]);
  return {
    create: useMutation({
      mutationFn: (position: PortfolioPositionRequest) => createPosition(position),
      onSuccess: () => {
        trackGoal('portfolio_position_added');
        return onSuccess();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, ...position }: PortfolioPositionRequest & { id: number }) => updatePosition(id, position),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: deletePosition, onSuccess }),
  };
}

/** Календарь выплат с сегодня по to */
export function usePortfolioCalendar(to: string) {
  const { authenticated } = useSession();
  return useQuery({
    queryKey: portfolioKeys.calendar(to),
    queryFn: () => fetchPortfolioCalendar(to),
    enabled: authenticated,
  });
}

export function useCalendarLink() {
  const { authenticated } = useSession();
  return useQuery({ queryKey: portfolioKeys.calendarLink(), queryFn: fetchCalendarLink, enabled: authenticated });
}

/**
 * Создание и отключение личной ссылки на календарь. Ответ на создание - единственный раз, когда виден токен: он
 * остаётся в данных мутации, а статус перечитывается без него
 */
export function useCalendarLinkMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: portfolioKeys.calendarLink() });
  return {
    create: useMutation({
      mutationFn: createCalendarLink,
      onSuccess: () => {
        trackGoal('portfolio_calendar_link_created');
        return onSuccess();
      },
    }),
    remove: useMutation({ mutationFn: deleteCalendarLink, onSuccess }),
  };
}
