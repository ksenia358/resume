import { useSyncExternalStore } from 'react';

// Narrower than this, the resume lays the contacts out in one column (see Profile.module.scss).
const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches);
}
