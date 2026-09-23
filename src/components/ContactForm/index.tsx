import { yupResolver } from '@hookform/resolvers/yup'
import { Alert, Button, Form, Input } from 'antd'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { sendContactForm } from '../../api/contact.ts'
import type { ContactFormValues } from './contactFormSchema.ts'
import { useContactFormSchema } from './contactFormSchema.ts'
import styles from './ContactForm.module.scss'

type Status = 'idle' | 'success' | 'error'

export function ContactForm() {
  const { t } = useTranslation()
  const schema = useContactFormSchema()
  const [status, setStatus] = useState<Status>('idle')

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (values: ContactFormValues) => {
    setStatus('idle')
    try {
      await sendContactForm(values)
      setStatus('success')
      reset()
    } catch {
      setStatus('error')
    }
  }

  return (
    <Form className={styles.form} layout="vertical" onFinish={handleSubmit(onSubmit)}>
      <Form.Item
        label={t('contact.name')}
        validateStatus={errors.name ? 'error' : ''}
        help={errors.name?.message}
      >
        <Controller name="name" control={control} render={({ field }) => <Input size={'large'} {...field} />} />
      </Form.Item>

      <Form.Item
        label={t('contact.email')}
        validateStatus={errors.email ? 'error' : ''}
        help={errors.email?.message}
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => <Input size={'large'} {...field} type="email" />}
        />
      </Form.Item>

      <Form.Item
        label={t('contact.message')}
        validateStatus={errors.message ? 'error' : ''}
        help={errors.message?.message}
      >
        <Controller
          name="message"
          control={control}
          render={({ field }) => <Input.TextArea size={'large'} {...field} rows={5} />}
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isSubmitting} size={'large'}>
          {isSubmitting ? t('contact.sending') : t('contact.submit')}
        </Button>
      </Form.Item>

      {status === 'success' && (
        <Alert type="success" showIcon message={t('contact.success')} />
      )}
      {status === 'error' && <Alert type="error" showIcon message={t('contact.error')} />}
    </Form>
  )
}
export default ContactForm