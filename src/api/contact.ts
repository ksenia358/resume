import type { ContactFormValues } from '../components/ContactForm/contactFormSchema.ts';

// PHP lives next to the site on the same hosting (public/api/contact.php).
const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_API_URL || '/api/contact.php';

export async function sendContactForm(values: ContactFormValues): Promise<void> {
  const response = await fetch(CONTACT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });

  if (!response.ok) {
    throw new Error(`Contact form request failed with status ${response.status}`);
  }
}
