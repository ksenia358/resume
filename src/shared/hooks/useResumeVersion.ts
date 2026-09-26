import { useSyncExternalStore } from 'react';

import { getResumeVersion, subscribeToResume } from '../api/resume';

// Changes after every saved edit, so data hooks know to load the resume again.
export function useResumeVersion(): number {
  return useSyncExternalStore(subscribeToResume, getResumeVersion);
}
