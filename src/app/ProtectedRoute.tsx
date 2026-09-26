import { Flex, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { isAuthenticated } from '../shared/api/auth';

// Pages inside are only for the logged-in admin; everyone else is sent to /login.
// This only hides the page: the API checks the admin cookie on its own for every change.
// In `yarn dev` there's no login at all; the production build drops this shortcut.
export function ProtectedRoute() {
  const location = useLocation();
  const [authenticated, setAuthenticated] = useState<boolean | null>(import.meta.env.DEV ? true : null);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      isAuthenticated().then(setAuthenticated);
    }
  }, []);

  if (authenticated === null) {
    return (
      <Flex
        justify="center"
        style={{ padding: '6rem 0' }}
      >
        <Spin size="large" />
      </Flex>
    );
  }

  return authenticated ? (
    <Outlet />
  ) : (
    <Navigate
      to={`/login?next=${encodeURIComponent(location.pathname)}`}
      replace
    />
  );
}
