import { useState } from 'react';
import { Card, Flex, Skeleton, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';

import profilePhoto from '../../shared/assets/photos/profile.jpeg';
import { Certificates } from './components/Certificates.tsx';
import { ContactForm } from './components/ContactForm';
import { Education } from './components/Education';
import { Experience, ExperienceTitle } from './components/Experience';
import { Footer } from './components/Footer';
import { GenderBadge } from './components/GenderBadge';
import { Profile } from './components/Profile';
import { SectionNav } from './components/Header/SectionNav';
import { Skills } from './components/Skills';
import { AddButton, EditButton, PhotoButton, VisibilityButton } from './components/EditButton';
import { ThemeToggle } from '../../shared/components/ThemeToggle';
import styles from './Resume.module.scss';
import classNames from 'classnames';
import { useProfile } from '../../shared/hooks/useProfile';
import type { SupportedLanguage } from '../../i18n';
import { saveResumeSection } from '../../shared/api/resume';
import type { ProfileInfo } from '../../shared/data/types';
import { useResumeEdit } from './editMode';

const { Title, Text } = Typography;

export function ResumePage() {
  const { t, i18n } = useTranslation();
  const [matchedTechs, setMatchedTechs] = useState<string[]>([]);
  const { data: profile } = useProfile();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;
  const editing = Boolean(useResumeEdit());
  // A toggled eye shows at once, until the saved profile comes back with it.
  const [toggled, setToggled] = useState<{ profile: ProfileInfo; hidden: string[] } | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const hidden = (toggled && toggled.profile === profile ? toggled.hidden : profile?.hiddenSections) ?? [];

  const toggleSection = async (key: string) => {
    if (!profile) {
      return;
    }
    const next = hidden.includes(key) ? hidden.filter((section) => section !== key) : [...hidden, key];
    setToggled({ profile, hidden: next });
    try {
      await saveResumeSection(lang, 'profile', { ...profile, hiddenSections: next });
    } catch (error) {
      setToggled(null);
      messageApi.error(`Не удалось сохранить: ${(error as Error).message}`);
    }
  };

  // The sections under the header; each can be hidden from the site with the eye in its title.
  const sections = [
    {
      key: 'experience',
      title: (
        <>
          <ExperienceTitle />
          <AddButton section="experience" />
        </>
      ),
      content: <Experience highlighted={matchedTechs} />,
    },
    {
      key: 'education',
      title: (
        <>
          {t('education.title')}
          <AddButton section="education" />
        </>
      ),
      content: <Education />,
    },
    {
      key: 'certificates',
      title: (
        <>
          {t('certificates.title')}
          <AddButton section="certificates" />
        </>
      ),
      content: <Certificates />,
    },
    {
      key: 'skills',
      title: (
        <>
          {t('skills.title')}
          <EditButton target={{ section: 'skills' }} />
        </>
      ),
      content: <Skills highlighted={matchedTechs} />,
    },
    { key: 'contact', title: t('contact.title'), className: styles['no-print'], content: <ContactForm /> },
  ];

  return (
    <>
      {messageContext}
      <SectionNav hidden={hidden} />

      <Flex
        vertical
        className={styles.page}
      >
        <Card
          className={styles.card}
          id="about"
        >
          <Flex
            gap="large"
            wrap="nowrap"
            justify="space-between"
            align="start"
          >
            <div className={styles.heroContent}>
              {profile ? (
                <>
                  <Title
                    level={1}
                    className={styles.title}
                  >
                    {profile.fullName}
                  </Title>
                  <Text
                    type="secondary"
                    className={styles.role}
                  >
                    {profile.role}
                  </Text>
                  {profile.tagline && (
                    <Text
                      type="secondary"
                      className={styles.tagline}
                    >
                      {profile.tagline}
                    </Text>
                  )}
                </>
              ) : (
                <Skeleton
                  active
                  title={{ width: '60%' }}
                  paragraph={{ rows: 1, width: '40%' }}
                />
              )}
              <div className={styles.profile}>
                <Profile onTechMatch={setMatchedTechs} />
              </div>
            </div>
            <div className={styles.photoWrap}>
              <img
                src={profile?.photo ?? profilePhoto}
                alt={profile?.fullName ?? ''}
                width={160}
                height={160}
                className={styles.photo}
              />
              <GenderBadge />
              <PhotoButton />
            </div>
          </Flex>
        </Card>

        {sections.map((section) =>
          !editing && hidden.includes(section.key) ? null : (
            <Card
              key={section.key}
              classNames={{ header: styles['card-header'] }}
              className={classNames(styles.card, section.className, {
                [styles.hiddenSection]: hidden.includes(section.key),
              })}
              id={section.key}
              title={
                <>
                  {section.title}
                  <VisibilityButton
                    hidden={hidden.includes(section.key)}
                    onToggle={() => toggleSection(section.key)}
                  />
                </>
              }
            >
              {section.content}
            </Card>
          ),
        )}

        <Footer />
      </Flex>

      <ThemeToggle />
    </>
  );
}
