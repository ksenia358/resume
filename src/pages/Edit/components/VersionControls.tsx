import { RollbackOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Flex, Popconfirm, message } from 'antd';
import { useEffect, useState } from 'react';

import { getSavedVersion, restoreVersion, saveVersion } from '../../../shared/api/versions';

// "2026-09-27 14:05:00" → "27.09, 14:05"
function formatSavedAt(value: string): string {
  const [date, time = ''] = value.split(' ');
  const [, month, day] = date.split('-');
  return `${day}.${month}, ${time.slice(0, 5)}`;
}

// One saved version of the whole resume: save it when it looks right, go back to it after edits that don't.
export function VersionControls() {
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'restore' | null>(null);
  const [messageApi, messageContext] = message.useMessage();

  useEffect(() => {
    getSavedVersion()
      .then(setSavedAt)
      .catch(() => setSavedAt(null));
  }, []);

  const run = async (action: 'save' | 'restore') => {
    setBusy(action);
    try {
      const latest = await (action === 'save' ? saveVersion() : restoreVersion());
      setSavedAt(latest);
      messageApi.success(action === 'save' ? 'Версия сохранена' : 'Резюме возвращено к сохранённой версии');
    } catch (error) {
      messageApi.error(`Не получилось: ${(error as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Flex
      gap="small"
      wrap
    >
      {messageContext}
      <Popconfirm
        title="Сохранить эту версию?"
        description={savedAt ? `Она заменит версию от ${formatSavedAt(savedAt)}.` : undefined}
        okText="Сохранить"
        cancelText="Нет"
        onConfirm={() => run('save')}
      >
        <Button
          size="small"
          type="primary"
          icon={<SaveOutlined />}
          loading={busy === 'save'}
        >
          Сохранить версию
        </Button>
      </Popconfirm>
      {savedAt && (
        <Popconfirm
          title={`Вернуть версию от ${formatSavedAt(savedAt)}?`}
          description="Все правки, сделанные после неё, пропадут."
          okText="Вернуть"
          okButtonProps={{ danger: true }}
          cancelText="Нет"
          onConfirm={() => run('restore')}
        >
          <Button
            size="small"
            icon={<RollbackOutlined />}
            loading={busy === 'restore'}
          >
            Вернуть версию от {formatSavedAt(savedAt)}
          </Button>
        </Popconfirm>
      )}
    </Flex>
  );
}
