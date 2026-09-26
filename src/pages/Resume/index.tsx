import { useState } from 'react';
import { Card, Flex, Typography } from 'antd';
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
import { ThemeToggle } from '../../shared/components/ThemeToggle';
import styles from './Resume.module.scss';
import classNames from 'classnames';

const { Title, Text } = Typography;

export function ResumePage() {
  const { t } = useTranslation();
  const [matchedTechs, setMatchedTechs] = useState<string[]>([]);

  return (
    <>
      <SectionNav />

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
              <Title
                level={1}
                className={styles.title}
              >
                {t('hero.name')}
              </Title>
              <Text
                type="secondary"
                className={styles.role}
              >
                {t('hero.role')}
              </Text>
              <Text
                type="secondary"
                className={styles.tagline}
              >
                {t('hero.tagline')}
              </Text>
              <div className={styles.profile}>
                <Profile onTechMatch={setMatchedTechs} />
              </div>
            </div>
            <div className={styles.photoWrap}>
              <img
                src={profilePhoto}
                alt={t('hero.name')}
                width={160}
                height={160}
                className={styles.photo}
              />
              <GenderBadge />
            </div>
          </Flex>
        </Card>

        <Card
          classNames={{ header: styles['card-header'] }}
          className={styles.card}
          id="experience"
          title={<ExperienceTitle />}
        >
          <Experience highlighted={matchedTechs} />
        </Card>

        <Card
          classNames={{ header: styles['card-header'] }}
          className={styles.card}
          id="education"
          title={t('education.title')}
        >
          <Education />
        </Card>

        <Card
          classNames={{ header: styles['card-header'] }}
          className={styles.card}
          id="certificates"
          title={t('certificates.title')}
        >
          <Certificates />
        </Card>

        <Card
          classNames={{ header: styles['card-header'] }}
          className={styles.card}
          id="skills"
          title={t('skills.title')}
        >
          <Skills highlighted={matchedTechs} />
        </Card>

        <Card
          classNames={{ header: styles['card-header'] }}
          className={classNames(styles.card, styles['no-print'])}
          id="contact"
          title={t('contact.title')}
        >
          <ContactForm />
        </Card>

        <Footer />
      </Flex>

      <ThemeToggle />
    </>
  );
}
