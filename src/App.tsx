import { Card, Flex, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

import profilePhoto from './assets/photos/profile.jpeg'
import { Certificates } from './components/Certificates.tsx'
import { ContactForm } from './components/ContactForm'
import { Education } from './components/Education'
import { Experience, ExperienceTitle } from './components/Experience'
import { Footer } from './components/Footer'
import { GenderBadge } from './components/GenderBadge'
import { Profile } from './components/Profile'
import { SectionNav } from './components/Header/SectionNav'
// import { Skills } from './components/Skills'
import { ThemeToggle } from './components/ThemeToggle'
import styles from './App.module.scss'

const { Title, Text } = Typography

function App() {
  const { t } = useTranslation()

  return (
    <>
      <SectionNav />

      <Flex vertical gap="large" className={styles.page}>
        <Card id="about">
          <Flex gap="large" wrap="nowrap" justify="space-between" align="start">
            <div className={styles.heroContent}>
              <Title level={1} className={styles.title}>
                {t('hero.name')}
              </Title>
              <Text type="secondary" className={styles.role}>
                {t('hero.role')}
              </Text>
              <Text type="secondary" className={styles.tagline}>
                {t('hero.tagline')}
              </Text>
              <div className={styles.profile}>
                <Profile />
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

        <Card id="experience" title={<ExperienceTitle />}>
          <Experience />
        </Card>

        <Card id="education" title={t('education.title')}>
          <Education />
        </Card>

        <Card id="certificates" title={t('certificates.title')}>
          <Certificates />
        </Card>

        {/*<Card id="skills" title={t('skills.title')}>*/}
        {/*  <Skills />*/}
        {/*</Card>*/}

        <Card id="contact" title={t('contact.title')} className={styles['no-print']}>
          <ContactForm />
        </Card>

        <Footer />
      </Flex>

      <ThemeToggle />
    </>
  )
}

export default App
