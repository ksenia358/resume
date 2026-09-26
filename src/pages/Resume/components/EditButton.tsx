import { CameraOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Tooltip, message } from 'antd';
import { useRef, useState } from 'react';
import classNames from 'classnames';

import { uploadPhoto } from '../../../shared/api/resume';
import { resizeToJpeg } from '../../../shared/utils/resizeImage';
import { useResumeEdit, type EditTarget, type ListSection } from '../editMode';
import styles from './EditButton.module.scss';

// A pencil next to a block; renders nothing outside the edit page.
export function EditButton({ target, className }: { target: EditTarget; className?: string }) {
  const edit = useResumeEdit();
  if (!edit) {
    return null;
  }

  return (
    <Tooltip title="Редактировать">
      <Button
        className={classNames(styles.button, className)}
        type="text"
        size="small"
        icon={<EditOutlined />}
        aria-label="Редактировать"
        onClick={() => edit(target)}
      />
    </Tooltip>
  );
}

// "Add" in the title of a list block; renders nothing outside the edit page.
export function AddButton({ section }: { section: ListSection }) {
  const edit = useResumeEdit();
  if (!edit) {
    return null;
  }

  return (
    <Button
      className={styles.add}
      size="small"
      icon={<PlusOutlined />}
      onClick={() => edit({ section })}
    >
      Добавить
    </Button>
  );
}

// An eye in a section title: open while the section is on the site, closed while it's hidden.
// Renders nothing outside the edit page.
export function VisibilityButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  const edit = useResumeEdit();
  if (!edit) {
    return null;
  }

  const label = hidden ? 'Скрыт на сайте — показать' : 'Виден на сайте — скрыть';
  return (
    <Tooltip title={label}>
      <Button
        className={styles.button}
        type="text"
        size="small"
        icon={hidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        aria-label={label}
        onClick={onToggle}
      />
    </Tooltip>
  );
}

// "Change photo" over the photo: picks a picture, scales it down and uploads it. Renders nothing outside the edit page.
export function PhotoButton() {
  const edit = useResumeEdit();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [messageApi, messageContext] = message.useMessage();
  if (!edit) {
    return null;
  }

  const onPick = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      await uploadPhoto(await resizeToJpeg(file));
    } catch (error) {
      messageApi.error(`Не удалось загрузить фото: ${(error as Error).message}`);
    } finally {
      setUploading(false);
      if (input.current) {
        input.current.value = '';
      }
    }
  };

  return (
    <>
      {messageContext}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => onPick(event.target.files?.[0])}
      />
      <Button
        className={styles.photo}
        shape="round"
        size="small"
        icon={<CameraOutlined />}
        loading={uploading}
        onClick={() => input.current?.click()}
      >
        Сменить фото
      </Button>
    </>
  );
}
