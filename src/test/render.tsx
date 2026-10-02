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

/** Подменяет fetch: на каждый вызов отдаёт следующий ответ, запросы складывает в calls */
export function mockFetch(...responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let index = 0;

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const response = responses[Math.min(index++, responses.length - 1)]!;
    return new Response(JSON.stringify(response.body), {
      status: response.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return calls;
}
