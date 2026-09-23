import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { FloatButton } from 'antd'
import { useTranslation } from 'react-i18next'

import { useThemeMode } from '../../app/themeMode.ts'
import styles from './ThemeToggle.module.scss'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { mode, toggle } = useThemeMode()

  return (
    <FloatButton
        className={styles.toggle}
      shape="circle"
      icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
      tooltip={mode === 'dark' ? t('theme.light') : t('theme.dark')}
      onClick={toggle}
    />
  )
}
export default ThemeToggle