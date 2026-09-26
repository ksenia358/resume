// PHP lives next to the site on the same hosting (public/api/auth.php).
const AUTH_ENDPOINT = import.meta.env.VITE_AUTH_API_URL || '/api/auth.php';

export type LoginError = 'wrong_password' | 'too_many_attempts' | 'failed';

export async function isAuthenticated(): Promise<boolean> {
  try {
    const response = await fetch(AUTH_ENDPOINT, { credentials: 'same-origin' });
    return response.ok && ((await response.json()) as { authenticated: boolean }).authenticated;
  } catch {
    return false;
  }
}

async function post(body: object): Promise<Response> {
  return fetch(AUTH_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Resolves with null on success, or with the reason the login didn't go through.
export async function login(password: string): Promise<LoginError | null> {
  try {
    const response = await post({ action: 'login', password });
    if (response.ok) {
      return null;
    }
    if (response.status === 401) {
      return 'wrong_password';
    }
    return response.status === 429 ? 'too_many_attempts' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function logout(): Promise<void> {
  await post({ action: 'logout' });
}
