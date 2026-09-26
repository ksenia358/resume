import { RouterProvider } from 'react-router';

import { AntdProvider } from './AntdProvider';
import { router } from './router';

export function App() {
  return (
    <AntdProvider>
      <RouterProvider router={router} />
    </AntdProvider>
  );
}
