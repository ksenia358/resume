import type { ContactFormValues } from '../components/ContactForm/contactFormSchema.ts';

// PHP lives next to the site on the same hosting (public/api/contact.php) and saves the message to the DB.
const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_API_URL || '/api/contact.php';

// The hosting blocks outgoing mail, so the visitor's browser emails the message through Web3Forms instead.
// One access key per recipient address (free plan: one inbox per key), comma-separated.
// Access keys are public by design — they only allow sending to the inbox they were issued for.
const WEB3FORMS_KEYS = (import.meta.env.VITE_WEB3FORMS_KEYS ?? '')
  .split(',')
  .map((key: string) => key.trim())
  .filter(Boolean);

async function saveToBackend(values: ContactFormValues): Promise<void> {
  const response = await fetch(CONTACT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(`Contact form request failed with status ${response.status}`);
  }
}

async function sendViaWeb3Forms(accessKey: string, values: ContactFormValues): Promise<void> {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: accessKey,
      subject: `Резюме: сообщение от ${values.name}`,
      from_name: 'Сайт-резюме',
      // "email" becomes Reply-To, so answering the letter goes straight to the visitor.
      name: values.name,
      email: values.email,
      message: values.message,
    }),
  });
  const result = (await response.json().catch(() => null)) as { success?: boolean } | null;

  if (!response.ok || !result?.success) {
    throw new Error(`Web3Forms request failed with status ${response.status}`);
  }
}

// Succeeds if the message reached at least one place: the DB or any inbox.
export async function sendContactForm(values: ContactFormValues): Promise<void> {
  const results = await Promise.allSettled([
    saveToBackend(values),
    ...WEB3FORMS_KEYS.map((key: string) => sendViaWeb3Forms(key, values)),
  ]);

  if (results.every((result) => result.status === 'rejected')) {
    throw new Error('Contact form message was not delivered anywhere');
  }
}
