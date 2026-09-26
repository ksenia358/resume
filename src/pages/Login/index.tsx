import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { login, type LoginError } from '../../shared/api/auth';
import { ThemeToggle } from '../../shared/components/ThemeToggle';
import styles from './Login.module.scss';

const { Title } = Typography;

const errorMessages: Record<LoginError, string> = {
  wrong_password: 'Неверный пароль',
  too_many_attempts: 'Слишком много попыток. Подождите 15 минут.',
  failed: 'Не удалось войти. Попробуйте позже.',
};

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<LoginError | null>(null);
  const [loading, setLoading] = useState(false);

  // Only paths on this site, so a crafted link can't send the admin elsewhere after login.
  const next = searchParams.get('next');
  const target = next?.startsWith('/') && !next.startsWith('//') ? next : '/edit';

  const onFinish = async ({ password }: { password: string }) => {
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    setError(result);
    if (!result) {
      navigate(target, { replace: true });
    }
  };

  return (
    <>
      <title>Вход</title>
      <ThemeToggle />
      <div className={styles.page}>
        <Card className={styles.card}>
          <Title level={3}>Вход в редактор</Title>
          <Form
            layout="vertical"
            onFinish={onFinish}
          >
            <Form.Item
              name="password"
              label="Пароль"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password
                size="large"
                autoFocus
                autoComplete="current-password"
              />
            </Form.Item>
            {error && (
              <Alert
                className={styles.error}
                type="error"
                showIcon
                title={errorMessages[error]}
              />
            )}
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
            >
              Войти
            </Button>
          </Form>
        </Card>
      </div>
    </>
  );
}
