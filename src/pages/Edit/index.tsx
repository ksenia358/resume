import { EditOutlined } from '@ant-design/icons';
import { Button, Flex, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import type { SupportedLanguage } from '../../i18n';
import { logout } from '../../shared/api/auth';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { ResumePage } from '../Resume';
import { ResumeEditContext, type EditTarget } from '../Resume/editMode';
import { EditModal } from './components/EditModal';
import { VersionControls } from './components/VersionControls';
import styles from './Edit.module.scss';

const { Text } = Typography;

// The resume itself with a pencil on every block; only reachable after login (see ProtectedRoute).
export function EditPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;
  const [target, setTarget] = useState<EditTarget | null>(null);
  const isMobile = useIsMobile();

  return (
    <>
      <title>Редактирование резюме</title>
      <ResumeEditContext.Provider value={setTarget}>
        <ResumePage />
      </ResumeEditContext.Provider>

      <Flex
        className={styles.toolbar}
        align="center"
        gap="small"
        wrap
      >
        <Text strong>
          <EditOutlined /> Режим редактирования
        </Text>
        <Text type="secondary">
          · {lang === 'ru' ? 'русская версия' : 'английская версия'} · раскладка{' '}
          {isMobile ? 'для телефона' : 'для компьютера'}
        </Text>
        <Flex
          gap="small"
          wrap
          className={styles.actions}
        >
          <VersionControls />
          <Button
            size="small"
            href="/"
          >
            На сайт
          </Button>
          <Button
            size="small"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Выйти
          </Button>
        </Flex>
      </Flex>

      {target && (
        <EditModal
          target={target}
          lang={lang}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}
