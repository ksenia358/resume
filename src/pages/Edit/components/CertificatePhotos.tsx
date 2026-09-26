import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Image, Popconfirm, Tag, Typography, message } from 'antd';
import { useRef, useState } from 'react';

import type { SupportedLanguage } from '../../../i18n';
import { deleteCertificatePhoto, getCertificates, uploadCertificatePhoto } from '../../../shared/api/resume';
import { photoUrl } from '../../../shared/data/certificatePhotos';
import { useResumeSection } from '../../../shared/hooks/useResumeSection';
import { resizeToJpeg } from '../../../shared/utils/resizeImage';
import styles from './CertificatePhotos.module.scss';

const { Text } = Typography;

// The scans of a certificate in its edit window: added and removed right away, apart from the form's "Save".
export function CertificatePhotos({ certificateId, lang }: { certificateId: string; lang: SupportedLanguage }) {
  // Read from the resume itself, so the list follows every upload and removal.
  const { data } = useResumeSection(getCertificates);
  const photos = data.find((item) => item.id === certificateId)?.photos ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [messageApi, messageContext] = message.useMessage();

  const onPick = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Scans keep more detail than the round profile photo, so the text stays readable.
        await uploadCertificatePhoto(lang, certificateId, await resizeToJpeg(file, 1600));
      }
    } catch (error) {
      messageApi.error(`Не удалось загрузить фото: ${(error as Error).message}`);
    } finally {
      setUploading(false);
      if (input.current) {
        input.current.value = '';
      }
    }
  };

  const onDelete = async (src: string) => {
    try {
      await deleteCertificatePhoto(certificateId, src);
    } catch (error) {
      messageApi.error(`Не удалось удалить фото: ${(error as Error).message}`);
    }
  };

  return (
    <div className={styles.block}>
      {messageContext}
      <Text strong>Фото</Text>
      <Image.PreviewGroup>
        <Flex
          wrap
          gap={8}
          className={styles.list}
        >
          {photos.map((photo) => (
            <div
              key={photo.src}
              className={styles.photo}
            >
              <Image
                src={photoUrl(photo.src)}
                width={88}
                height={88}
                className={styles.image}
              />
              <Tag className={styles.lang}>{photo.isOfficialDocument ? 'удост.' : photo.lang.toUpperCase()}</Tag>
              <Popconfirm
                title="Удалить фото?"
                okText="Удалить"
                okButtonProps={{ danger: true }}
                cancelText="Нет"
                onConfirm={() => onDelete(photo.src)}
              >
                <Button
                  className={styles.delete}
                  size="small"
                  shape="circle"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="Удалить фото"
                />
              </Popconfirm>
            </div>
          ))}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => onPick(event.target.files)}
          />
          <Button
            className={styles.add}
            icon={<PlusOutlined />}
            loading={uploading}
            onClick={() => input.current?.click()}
          >
            Добавить фото
          </Button>
        </Flex>
      </Image.PreviewGroup>
      <Text type="secondary">
        Новые фото относятся к {lang === 'ru' ? 'русской' : 'английской'} версии: там они показываются первыми.
      </Text>
    </div>
  );
}
