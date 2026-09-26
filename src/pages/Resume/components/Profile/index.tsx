import { Skeleton } from 'antd';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import emailIcon from '../../../../shared/assets/icons/contact-email.svg';
import messageIcon from '../../../../shared/assets/icons/contact-message.svg';
import phoneIcon from '../../../../shared/assets/icons/contact-phone.svg';
import matchIcon from '../../../../shared/assets/icons/contact-match.svg';
import telegramIcon from '../../../../shared/assets/icons/contact-telegram.svg';
import { useProfile } from '../../../../shared/hooks/useProfile.ts';
// import { calculateAge } from '../../../../shared/utils/calculateAge.ts'
import { ContactRow } from '../ContactRow';
import { TechMatch } from '../TechMatch';
import styles from './Profile.module.scss';

// const { Text } = Typography

function scrollToContact(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

interface ProfileProps {
  onTechMatch: (matched: string[]) => void;
}

export function Profile({ onTechMatch }: ProfileProps) {
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
          icon={matchIcon}
          iconLabel={t('techMatch.link')}
          items={['tech-match']}
          className={styles['no-print']}
          renderItem={() => <TechMatch onApply={onTechMatch} />}
        />

        {data.phones.map((phone) => (
          <ContactRow
            key={phone}
            icon={phoneIcon}
            iconLabel={t('profile.phone')}
            items={[phone]}
            renderItem={() => <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>}
          />
        ))}

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
