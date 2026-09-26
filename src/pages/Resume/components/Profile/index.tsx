import { Skeleton, message } from 'antd';
import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedLanguage } from '../../../../i18n';
import emailIcon from '../../../../shared/assets/icons/contact-email.svg';
import messageIcon from '../../../../shared/assets/icons/contact-message.svg';
import phoneIcon from '../../../../shared/assets/icons/contact-phone.svg';
import matchIcon from '../../../../shared/assets/icons/contact-match.svg';
import telegramIcon from '../../../../shared/assets/icons/contact-telegram.svg';
import { saveResumeSection } from '../../../../shared/api/resume';
import type { ProfileInfo } from '../../../../shared/data/types';
import { useIsMobile } from '../../../../shared/hooks/useIsMobile';
import { useProfile } from '../../../../shared/hooks/useProfile.ts';
// import { calculateAge } from '../../../../shared/utils/calculateAge.ts'
import { useResumeEdit } from '../../editMode';
import { ContactRow } from '../ContactRow';
import { EditButton } from '../EditButton';
import { TechMatch } from '../TechMatch';
import { SortableContacts } from './SortableContacts';
import styles from './Profile.module.scss';

// const { Text } = Typography

function scrollToContact(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
}

// A contact list is shown either in one column, or with a column per entry.
function columns(items: string[], together: boolean): string[][] {
  return together ? [items] : items.map((item) => [item]);
}

export type ContactCell = { key: string; node: ReactNode };

// Cells in the saved order (contactsOrder holds their keys); cells it doesn't know yet go last.
function inOrder(cells: ContactCell[], order: string[] = []): ContactCell[] {
  const rank = (cell: ContactCell) => {
    const index = order.indexOf(cell.key);
    return index === -1 ? order.length : index;
  };
  return [...cells].sort((a, b) => rank(a) - rank(b));
}

interface ProfileProps {
  onTechMatch: (matched: string[]) => void;
}

export function Profile({ onTechMatch }: ProfileProps) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;
  const { data, loading } = useProfile();
  const editing = Boolean(useResumeEdit());
  // Phones have a layout of their own: dragging on a narrow screen changes only that one.
  const isMobile = useIsMobile();
  const orderField = isMobile ? 'contactsOrderMobile' : 'contactsOrder';
  // A dragged order shows at once, until the saved profile comes back with it.
  const [dragged, setDragged] = useState<{ profile: ProfileInfo; order: string[] } | null>(null);
  const [messageApi, messageContext] = message.useMessage();

  if (loading || !data)
    return (
      <Skeleton
        active
        paragraph={{ rows: 1 }}
      />
    );

  // const age = calculateAge(data.birthDate)

  // A column per list, or per entry of a split list; the key says which, so the order survives edits.
  const listCells = (
    list: 'phones' | 'email' | 'telegram',
    together: boolean,
    render: (items: string[]) => ReactNode,
  ) =>
    columns(data[list], together).map((items) => ({
      key: together ? list : `${list}:${items[0]}`,
      node: render(items),
    }));

  const cells: ContactCell[] = [
    ...(data.showTechMatch === false
      ? []
      : [
          {
            key: 'techMatch',
            node: (
              <ContactRow
                icon={matchIcon}
                iconLabel={t('techMatch.link')}
                items={['tech-match']}
                className={styles['no-print']}
                renderItem={() => <TechMatch onApply={onTechMatch} />}
              />
            ),
          },
        ]),
    ...listCells('phones', data.phonesTogether ?? false, (phones) => (
      <ContactRow
        icon={phoneIcon}
        iconLabel={t('profile.phone')}
        items={phones}
        renderItem={(phone) => <a href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</a>}
      />
    )),
    ...listCells('email', data.emailTogether ?? true, (emails) => (
      <ContactRow
        icon={emailIcon}
        iconLabel="Email"
        items={emails}
        renderItem={(email) => <a href={`mailto:${email}`}>{email}</a>}
      />
    )),
    ...listCells('telegram', data.telegramTogether ?? true, (handles) => (
      <ContactRow
        icon={telegramIcon}
        iconLabel="Telegram"
        items={handles}
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
    )),
    ...(data.showWrite === false
      ? []
      : [
          {
            key: 'write',
            node: (
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
            ),
          },
        ]),
  ];

  const savedOrder = isMobile ? (data.contactsOrderMobile ?? data.contactsOrder) : data.contactsOrder;
  const ordered = inOrder(cells, dragged?.profile === data ? dragged.order : savedOrder);

  const onReorder = async (order: string[]) => {
    setDragged({ profile: data, order });
    try {
      await saveResumeSection(lang, 'profile', { ...data, [orderField]: order });
    } catch (error) {
      setDragged(null);
      messageApi.error(`Не удалось сохранить порядок: ${(error as Error).message}`);
    }
  };

  return (
    <>
      {/*<Text className={styles['no-print']}>{t('profile.age', { count: age })}</Text>*/}
      {messageContext}

      <div className={styles.grid}>
        <EditButton
          target={{ section: 'profile' }}
          className={styles.edit}
        />
        {editing ? (
          <SortableContacts
            cells={ordered}
            onReorder={onReorder}
          />
        ) : (
          ordered.map((cell) => <div key={cell.key}>{cell.node}</div>)
        )}
      </div>
    </>
  );
}
export default Profile;
