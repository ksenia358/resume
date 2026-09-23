import { Skeleton } from 'antd';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import emailIcon from '../../assets/icons/contact-email.svg';
import messageIcon from '../../assets/icons/contact-message.svg';
import phoneIcon from '../../assets/icons/contact-phone.svg';
import telegramIcon from '../../assets/icons/contact-telegram.svg';
import { useProfile } from '../../hooks/useProfile.ts';
// import { calculateAge } from '../../utils/calculateAge.ts'
import { ContactRow } from '../ContactRow';
import styles from './Profile.module.scss';

// const { Text } = Typography

function scrollToContact(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

export function Profile() {
  const { t } = useTranslation();
  const { data, loading } = useProfile();

  if (loading || !data)
    return (
      <Skeleton
        active
        paragraph={{ rows: 1 }}
      />
    );

  // const age = calculateAge(data.birthDate)

  return (
    <>
      {/*<Text className={styles['no-print']}>{t('profile.age', { count: age })}</Text>*/}

      <div className={styles.grid}>
        <ContactRow
          icon={phoneIcon}
          iconLabel={t('profile.phone')}
          items={data.phones}
          renderItem={(phone) => <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>}
        />

        <ContactRow
          icon={emailIcon}
          iconLabel="Email"
          items={data.email}
          renderItem={(email) => <a href={`mailto:${email}`}>{email}</a>}
        />

        <ContactRow
          icon={telegramIcon}
          iconLabel="Telegram"
          items={data.telegram}
          renderItem={(handle) => (
            <a
              href={`https://t.me/${handle.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
            >
              {handle}
            </a>
          )}
        />

        <ContactRow
          icon={messageIcon}
          iconLabel={t('profile.write')}
          items={['contact']}
          className={styles['no-print']}
          renderItem={() => (
            <a
              href="#contact"
              onClick={scrollToContact}
            >
              {t('profile.write')}
            </a>
          )}
        />
      </div>
    </>
  );
}
export default Profile;
