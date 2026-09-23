import type { ContactFormValues } from '../components/ContactForm/contactFormSchema.ts'

const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_API_URL

export async function sendContactForm(values: ContactFormValues): Promise<void> {
  if (!CONTACT_ENDPOINT) {
    throw new Error(
      'VITE_CONTACT_API_URL is not set — PHP backend is not connected yet.',
    )
  }

  const response = await fetch(CONTACT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  })

  if (!response.ok) {
    throw new Error(`Contact form request failed with status ${response.status}`)
  }
}
