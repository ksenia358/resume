import { useProfile } from '../../hooks/useProfile.ts'
import { GenderIcon } from './GenderIcon.tsx'
import styles from './GenderBadge.module.scss'

export function GenderBadge() {
  const { data } = useProfile()

  if (!data) return null

  return (
    <div className={styles.gender}
    >
      <GenderIcon code={data.genderCode} label={data.gender} size={26} />
    </div>
  )
}
export default GenderBadge
