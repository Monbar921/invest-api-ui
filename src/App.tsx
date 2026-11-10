import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { type Session, SessionContext } from './api/session';
import { router } from './router';
import { theme } from './theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // бэк обновляет цены раз в 15 минут - чаще перезапрашивать незачем
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App({ session }: { session: Session }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <QueryClientProvider client={queryClient}>
        <SessionContext value={session}>
          <RouterProvider router={router} />
        </SessionContext>
      </QueryClientProvider>
    </MantineProvider>
  );
}
