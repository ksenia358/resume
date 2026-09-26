import { createBrowserRouter, Navigate } from 'react-router';

import { ProtectedRoute } from './ProtectedRoute';

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
    path: '/login',
    lazy: () => import('../pages/Login').then(({ LoginPage }) => ({ Component: LoginPage })),
  },
  // Admin pages: only after login.
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/edit',
        lazy: () => import('../pages/Edit').then(({ EditPage }) => ({ Component: EditPage })),
      },
    ],
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
