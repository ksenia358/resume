import { useTranslation } from 'react-i18next'
import * as yup from 'yup'

export interface ContactFormValues {
  name: string
  email: string
  message: string
}

export function useContactFormSchema() {
  const { t } = useTranslation()

  return yup.object({
    name: yup.string().trim().required(t('contact.errors.nameRequired')),
    email: yup
      .string()
      .trim()
      .required(t('contact.errors.emailRequired'))
      .email(t('contact.errors.emailInvalid')),
    message: yup
      .string()
      .trim()
      .required(t('contact.errors.messageRequired'))
      .min(10, t('contact.errors.messageMin')),
  })
}
