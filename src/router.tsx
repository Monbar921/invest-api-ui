import { createBrowserRouter } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { BondsPage } from './pages/BondsPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      // гостю - лендинг, вошедшему - список облигаций
      { index: true, element: <HomePage /> },
      { path: 'bonds', element: <BondsPage /> },
      {
        path: 'bonds/:ticker',
        // карточка тянет за собой графики (recharts) - грузим её отдельным чанком, только когда открывают
        lazy: () => import('./pages/BondPage').then((module) => ({ Component: module.BondPage })),
      },
      {
        path: 'issuers/:id',
        lazy: () => import('./pages/IssuerPage').then((module) => ({ Component: module.IssuerPage })),
      },
      {
        path: 'collections/:slug',
        lazy: () => import('./pages/CollectionPage').then((module) => ({ Component: module.CollectionPage })),
      },
      {
        path: 'alerts',
        lazy: () => import('./pages/AlertsPage').then((module) => ({ Component: module.AlertsPage })),
      },
      {
        path: 'portfolio',
        lazy: () => import('./pages/PortfolioPage').then((module) => ({ Component: module.PortfolioPage })),
      },
      {
        path: 'calculator',
        lazy: () => import('./pages/CalculatorPage').then((module) => ({ Component: module.CalculatorPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
