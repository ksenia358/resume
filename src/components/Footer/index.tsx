import { Typography } from 'antd'

const { Text } = Typography

import styles from './Footer.module.scss'
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <Text type="secondary" className={styles.footer}>
      &copy; Copyright {year}
    </Text>
  )
}
export default Footer