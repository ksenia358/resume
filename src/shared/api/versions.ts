import { invalidateResume } from './resume';

// PHP next to resume.php (public/api/versions.php); in `yarn dev` the dev server keeps the version.
const VERSIONS_ENDPOINT = import.meta.env.VITE_VERSIONS_API_URL || '/api/versions.php';

// When the saved version was made ("2026-09-27 14:05:00"), or null while there is none.
export async function getSavedVersion(): Promise<string | null> {
  const response = await fetch(VERSIONS_ENDPOINT, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
  return ((await response.json()) as { latest: string | null }).latest;
}

async function post(action: 'save' | 'restore'): Promise<string> {
  const response = await fetch(VERSIONS_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  const result = (await response.json().catch(() => ({}))) as { latest?: string; error?: string };
  if (!response.ok || !result.latest) {
    throw new Error(result.error ?? `status ${response.status}`);
  }
  return result.latest;
}

// Remembers the resume as it is now, in place of the version saved before.
export function saveVersion(): Promise<string> {
  return post('save');
}

// Throws away the edits made since the version was saved; the version itself stays.
export async function restoreVersion(): Promise<string> {
  const latest = await post('restore');
  invalidateResume();
  return latest;
}
