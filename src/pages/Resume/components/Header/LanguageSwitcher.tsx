import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';

import { supportedLanguages } from '../../../../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Segmented
      value={i18n.resolvedLanguage}
      onChange={(value) => i18n.changeLanguage(String(value))}
      options={supportedLanguages.map((lng) => ({
        label: lng.toUpperCase(),
        value: lng,
      }))}
    />
  );
}
