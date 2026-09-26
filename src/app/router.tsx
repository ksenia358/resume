import { createBrowserRouter, Navigate } from 'react-router';

// All pages of the site. Each one is loaded only when it's opened.
export const router = createBrowserRouter([
  {
    path: '/',
    lazy: () => import('../pages/Resume').then(({ ResumePage }) => ({ Component: ResumePage })),
  },
  {
    path: '/king',
    lazy: () => import('../pages/King').then(({ KingPage }) => ({ Component: KingPage })),
  },
  {
    path: '*',
    element: (
      <Navigate
        to="/"
        replace
      />
    ),
  },
]);
