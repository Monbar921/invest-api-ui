import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { theme } from '../theme';

/** Рендерит элемент по маршруту path, как если бы пользователь открыл url */
export function renderRoute(element: ReactElement, { path, url }: { path: string; url: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <div>other page</div> },
    ],
    { initialEntries: [url] },
  );

  return {
    router,
    ...render(
      <MantineProvider theme={theme}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </MantineProvider>,
    ),
  };
}

export function renderWithMantine(element: ReactElement) {
  return render(<MantineProvider theme={theme}>{element}</MantineProvider>);
}

export const EMPTY_NEWS_PAGE = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };

/**
 * Запросы ленты новостей, обзора рынка и событий облигации, которые делают страницы попутно. mockFetch отвечает на них
 * пустыми данными сам и не считает их в calls - иначе они съедали бы ответы, рассчитанные на основной запрос.
 */
const SIDE_REQUESTS: [RegExp, unknown][] = [
  [
    /\/api\/bonds\/market-overview$/,
    {
      keyRate: null,
      keyRateSince: null,
      previousKeyRate: null,
      keyRateYearChange: null,
      keyRateMeetingDate: null,
      keyRateMeetingChange: null,
      currencies: [],
    },
  ],
  [/\/api\/bonds\/(news|[^/]+\/news)\?/, EMPTY_NEWS_PAGE],
  [/\/api\/bonds\/[^/]+\/events$/, []],
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Подменяет fetch: на каждый вызов отдаёт следующий ответ, запросы складывает в calls */
export function mockFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let index = 0;

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const side = SIDE_REQUESTS.find(([pattern]) => pattern.test(url));
    if (side) {
      return json(side[1]);
    }
    calls.push({ url, init });
    const response = responses[Math.min(index++, responses.length - 1)]!;
    // у 204 тела быть не может - Response с телом бросает TypeError
    return new Response(response.status === 204 ? null : JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return calls;
}

/** Подменяет fetch ответами по адресу: первый шаблон, которому подходит URL; запросы складывает в calls */
export function mockFetchByUrl(routes: [RegExp, unknown][]) {
  const calls: string[] = [];

  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const route = routes.find(([pattern]) => pattern.test(url)) ?? SIDE_REQUESTS.find(([pattern]) => pattern.test(url));
    return route ? json(route[1]) : json({ title: 'Not Found' }, 404);
  });

  return calls;
}
