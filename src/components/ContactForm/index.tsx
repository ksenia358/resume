import { yupResolver } from '@hookform/resolvers/yup';
import { Button, Form, Input, Modal, Result, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { sendContactForm } from '../../api/contact.ts';
import type { ContactFormValues } from './contactFormSchema.ts';
import { useContactFormSchema } from './contactFormSchema.ts';
import styles from './ContactForm.module.scss';

type Status = 'idle' | 'success' | 'error';

export function ContactForm() {
  const { t } = useTranslation();
  const schema = useContactFormSchema();
  const [status, setStatus] = useState<Status>('idle');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: yupResolver(schema),
  });

  // The error tooltip goes away by itself after a while.
  useEffect(() => {
    if (status !== 'error') {
      return;
    }
    const timer = setTimeout(() => setStatus('idle'), 5000);
    return () => clearTimeout(timer);
  }, [status]);

  const onSubmit = async (values: ContactFormValues) => {
    setStatus('idle');
    try {
      await sendContactForm(values);
      setStatus('success');
      reset();
    } catch {
      setStatus('error');
    }
  };

  return (
    <Form
      className={styles.form}
      layout="vertical"
      onFinish={handleSubmit(onSubmit)}
    >
      <Form.Item
        required
        label={t('contact.name')}
        validateStatus={errors.name ? 'error' : ''}
        help={errors.name?.message}
      >
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              size={'large'}
              {...field}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        required
        label={t('contact.email')}
        validateStatus={errors.email ? 'error' : ''}
        help={errors.email?.message}
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <Input
              size={'large'}
              {...field}
              type="email"
            />
          )}
        />
      </Form.Item>

      <Form.Item
        required
        label={t('contact.message')}
        validateStatus={errors.message ? 'error' : ''}
        help={errors.message?.message}
      >
        <Controller
          name="message"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              size={'large'}
              {...field}
              rows={5}
            />
          )}
        />
      </Form.Item>

      <Form.Item>
        {/* Right above the button the user just pressed, so it's seen without scrolling. A click outside closes it. */}
        <Tooltip
          open={status === 'error'}
          trigger="click"
          onOpenChange={(open) => !open && setStatus('idle')}
          placement="top"
          color="red"
          title={t('contact.error')}
        >
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={isSubmitting}
            size={'large'}
          >
            {isSubmitting ? t('contact.sending') : t('contact.submit')}
          </Button>
        </Tooltip>
      </Form.Item>

      <Modal
        open={status === 'success'}
        centered
        footer={null}
        onCancel={() => setStatus('idle')}
      >
        <Result
          status="success"
          title={t('contact.success')}
          subTitle={t('contact.successHint')}
          extra={
            <Button
              type="primary"
              size="large"
              onClick={() => setStatus('idle')}
            >
              {t('contact.close')}
            </Button>
          }
        />
      </Modal>
    </Form>
  );
}
export default ContactForm;
