export function calculateAge(birthDate: string, now: Date = new Date()): number {
  const [year, month, day] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - year;
  const hasHadBirthdayThisYear = now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
