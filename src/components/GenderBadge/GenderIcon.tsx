import genderFemale from '../../assets/icons/gender-female.svg'
import genderMale from '../../assets/icons/gender-male.svg'
import type { GenderCode } from '../../data/types.ts'

const ICONS: Record<GenderCode, string> = {
  female: genderFemale,
  male: genderMale,
}

interface GenderIconProps {
  code: GenderCode
  label: string
  size?: number
}

export function GenderIcon({ code, label, size = 20 }: GenderIconProps) {
  return (
    <img
      src={ICONS[code]}
      alt={label}
      width={size}
      height={size}
      style={{ verticalAlign: 'middle' }}
    />
  )
}
