import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { BondsPage } from './pages/BondsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/bonds" replace /> },
      { path: 'bonds', element: <BondsPage /> },
      {
        path: 'bonds/:ticker',
        // карточка тянет за собой графики (recharts) - грузим её отдельным чанком, только когда открывают
        lazy: () => import('./pages/BondPage').then((module) => ({ Component: module.BondPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
