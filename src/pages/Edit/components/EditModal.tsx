import {
  Button,
  Checkbox,
  ConfigProvider,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Typography,
  message,
} from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { useEffect, useState } from 'react';

import type { SupportedLanguage } from '../../../i18n';
import { deleteResumeItem, getProfile, getSkills, saveResumeSection } from '../../../shared/api/resume';
import type { ProfileInfo } from '../../../shared/data/types';
import type { EditTarget } from '../../Resume/editMode';
import { CertificatePhotos } from './CertificatePhotos';

const { Text } = Typography;

type FieldKind = 'text' | 'url' | 'month' | 'date' | 'year' | 'lines' | 'tags' | 'checkbox' | 'gender';

type Field = {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  hint?: string;
  // Used when the data has no value yet.
  defaultValue?: unknown;
};

// The badge's caption (its alt text), in the language of the version being edited.
const GENDER_LABELS: Record<SupportedLanguage, Record<string, string>> = {
  ru: { female: 'Женский', male: 'Мужской', none: '' },
  en: { female: 'Female', male: 'Male', none: '' },
};

// Month names in the calendars are Russian, like the rest of the editor.
dayjs.locale('ru');

// How each kind of date is stored in the JSON / database.
const DATE_FORMATS: Partial<Record<FieldKind, string>> = { month: 'YYYY-MM', date: 'YYYY-MM-DD', year: 'YYYY' };

// The form of each block; values are converted to and from the JSON shape in toForm/fromForm.
const fields: Record<EditTarget['section'], Field[]> = {
  profile: [
    { name: 'fullName', label: 'Имя', required: true },
    { name: 'role', label: 'Профессия', required: true },
    { name: 'tagline', label: 'Подпись под профессией' },
    { name: 'birthDate', label: 'Дата рождения', kind: 'date', required: true },
    { name: 'genderCode', label: 'Значок пола', kind: 'gender', required: true },
    { name: 'phones', label: 'Телефоны', kind: 'tags' },
    { name: 'phonesTogether', label: 'Все телефоны в одной колонке', kind: 'checkbox' },
    { name: 'email', label: 'Email', kind: 'tags' },
    { name: 'emailTogether', label: 'Все email в одной колонке', kind: 'checkbox', defaultValue: true },
    { name: 'telegram', label: 'Telegram', kind: 'tags' },
    { name: 'telegramTogether', label: 'Все Telegram в одной колонке', kind: 'checkbox', defaultValue: true },
    { name: 'showTechMatch', label: 'Показывать «Я вам подхожу?»', kind: 'checkbox', defaultValue: true },
    { name: 'showWrite', label: 'Показывать «Написать»', kind: 'checkbox', defaultValue: true },
  ],
  experience: [
    { name: 'role', label: 'Должность', required: true },
    { name: 'company', label: 'Компания', required: true },
    { name: 'url', label: 'Сайт компании', kind: 'url' },
    { name: 'location', label: 'Город' },
    { name: 'startDate', label: 'Начало', kind: 'month', required: true },
    { name: 'endDate', label: 'Окончание', kind: 'month', hint: 'Пусто — по настоящее время' },
    {
      name: 'highlights',
      // Replaced by labelFor() with the form that matches the gender in the profile.
      label: 'Что делал(а)',
      kind: 'lines',
      required: true,
      hint: 'Каждый пункт с новой строки. Ссылка: [текст](https://…)',
    },
    { name: 'technologies', label: 'Навыки', kind: 'tags', hint: 'Общие для русской и английской версии' },
    { name: 'web', label: 'Считать в опыт веб-разработки', kind: 'checkbox' },
  ],
  education: [
    { name: 'institution', label: 'Учебное заведение', required: true },
    { name: 'url', label: 'Сайт', kind: 'url' },
    { name: 'description', label: 'Факультет' },
    { name: 'field', label: 'Специальность' },
    { name: 'degree', label: 'Степень', required: true },
    { name: 'level', label: 'Уровень' },
    { name: 'startDate', label: 'Начало', kind: 'month', required: true },
    { name: 'endDate', label: 'Окончание', kind: 'month', hint: 'Пусто — ещё учусь' },
  ],
  certificates: [
    { name: 'name', label: 'Курс', required: true },
    { name: 'issuer', label: 'Кто выдал', required: true },
    { name: 'issuerUrl', label: 'Сайт организации', kind: 'url' },
    { name: 'date', label: 'Год', kind: 'year', required: true },
    { name: 'url', label: 'Ссылка на сертификат', kind: 'url' },
  ],
  skills: [{ name: 'skills', label: 'Навыки', kind: 'tags', required: true, hint: 'От самых частых к редким' }],
};

const newTitles: Partial<Record<EditTarget['section'], string>> = {
  experience: 'Новое место работы',
  education: 'Новое образование',
  certificates: 'Новый сертификат',
};

const titles: Record<EditTarget['section'], string> = {
  profile: 'Контакты',
  experience: 'Опыт работы',
  education: 'Образование',
  certificates: 'Сертификат',
  skills: 'Навыки',
};

type Values = Record<string, unknown>;

function toForm(section: EditTarget['section'], data: Values): Values {
  const values: Values = { ...data };
  for (const field of fields[section]) {
    if (values[field.name] === undefined && field.defaultValue !== undefined) {
      values[field.name] = field.defaultValue;
    }
    if (field.kind === 'lines') {
      values[field.name] = ((data[field.name] as string[] | undefined) ?? []).join('\n');
    }
    const format = field.kind && DATE_FORMATS[field.kind];
    if (format) {
      const value = data[field.name];
      values[field.name] = value ? dayjs(String(value), format) : null;
    }
  }
  return values;
}

function fromForm(section: EditTarget['section'], values: Values, id?: string): Values {
  const data: Values = id ? { id } : {};
  for (const field of fields[section]) {
    const value = values[field.name];
    if (field.kind === 'lines') {
      data[field.name] = String(value ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    } else if (field.kind === 'tags') {
      data[field.name] = ((value as string[] | undefined) ?? []).map((tag) => tag.trim()).filter(Boolean);
    } else if (field.kind === 'checkbox') {
      data[field.name] = Boolean(value);
    } else if (field.kind && DATE_FORMATS[field.kind]) {
      const date = value ? (value as Dayjs).format(DATE_FORMATS[field.kind]) : null;
      // An empty end date means "present"; other empty dates are left out.
      if (date || field.name === 'endDate') {
        data[field.name] = date;
      }
    } else {
      // Empty optional fields are left out, like in the JSON files.
      const text = String(value ?? '').trim();
      if (text) {
        data[field.name] = text;
      }
    }
  }
  return data;
}

function renderInput(field: Field) {
  switch (field.kind) {
    case 'lines':
      return <Input.TextArea autoSize={{ minRows: 4, maxRows: 14 }} />;
    case 'tags':
      return (
        <Select
          mode="tags"
          open={false}
          suffixIcon={null}
          tokenSeparators={[',']}
          placeholder="Введите и нажмите Enter"
        />
      );
    case 'checkbox':
      return <Checkbox>{field.label}</Checkbox>;
    case 'gender':
      return (
        <Select
          options={[
            { value: 'female', label: 'Женский' },
            { value: 'male', label: 'Мужской' },
            { value: 'none', label: 'Не показывать' },
          ]}
        />
      );
    case 'month':
      return (
        <DatePicker
          picker="month"
          format="MMMM YYYY"
          placeholder="Выберите месяц"
          style={{ width: '100%' }}
        />
      );
    case 'date':
      return (
        <DatePicker
          format="DD.MM.YYYY"
          placeholder="Выберите дату"
          style={{ width: '100%' }}
        />
      );
    case 'year':
      return (
        <DatePicker
          picker="year"
          placeholder="Выберите год"
          style={{ width: '100%' }}
        />
      );
    case 'url':
      return <Input placeholder="https://…" />;
    default:
      return <Input />;
  }
}

function rulesFor(field: Field) {
  const rules: object[] = [];
  if (field.required) {
    rules.push({ required: true, message: 'Заполните поле' });
  }
  const patterns: Partial<Record<FieldKind, [RegExp, string]>> = {
    url: [/^https?:\/\/\S+$/, 'Ссылка должна начинаться с http:// или https://'],
  };
  const pattern = field.kind && patterns[field.kind];
  if (pattern) {
    rules.push({ pattern: pattern[0], message: pattern[1] });
  }
  return rules;
}

type Props = {
  target: EditTarget;
  lang: SupportedLanguage;
  onClose: () => void;
};

export function EditModal({ target, lang, onClose }: Props) {
  const [form] = Form.useForm<Values>();
  const [saving, setSaving] = useState(false);
  // Not fields of the form: set on the page itself (dragged contacts, eyes of sections), passed through unchanged.
  const [passThrough, setPassThrough] = useState<
    Pick<ProfileInfo, 'contactsOrder' | 'contactsOrderMobile' | 'hiddenSections'>
  >({});
  const [messageApi, messageContext] = message.useMessage();
  const { section } = target;
  const item = 'item' in target ? target.item : undefined;
  const isNew = section !== 'profile' && section !== 'skills' && !item;
  const id = item?.id;

  // Items come with the pencil (a new one starts empty); the profile and skills are whole blocks, so they're read here.
  // "Что делала" for a woman, "Что делал" otherwise — the gender comes from the profile.
  const [female, setFemale] = useState(false);
  useEffect(() => {
    if (section === 'experience') {
      getProfile(lang).then((profile) => setFemale(profile.genderCode === 'female'));
    }
  }, [section, lang]);
  const labelFor = (field: Field) =>
    field.name === 'highlights' && section === 'experience' ? (female ? 'Что делала' : 'Что делал') : field.label;

  useEffect(() => {
    if (item) {
      form.setFieldsValue(toForm(section, item as unknown as Values));
    } else if (isNew) {
      form.resetFields();
    } else if (section === 'profile') {
      getProfile(lang).then((profile) => {
        setPassThrough({
          contactsOrder: profile.contactsOrder,
          contactsOrderMobile: profile.contactsOrderMobile,
          hiddenSections: profile.hiddenSections,
        });
        form.setFieldsValue(toForm(section, profile as unknown as Values));
      });
    } else {
      getSkills(lang).then((skills) => form.setFieldsValue({ skills }));
    }
  }, [form, item, isNew, section, lang]);

  const onSave = async () => {
    // Invalid fields are already highlighted by the form.
    const values = await form.validateFields().catch(() => null);
    if (!values) {
      return;
    }
    const data = fromForm(section, values, id);
    if (section === 'profile') {
      data.gender = GENDER_LABELS[lang][String(data.genderCode)] ?? '';
      Object.assign(data, passThrough);
    }
    setSaving(true);
    try {
      await saveResumeSection(lang, section, section === 'skills' ? data.skills : data, id);
      onClose();
    } catch (error) {
      messageApi.error(`Не удалось сохранить: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id || section === 'profile' || section === 'skills') {
      return;
    }
    try {
      await deleteResumeItem(lang, section, id);
      onClose();
    } catch (error) {
      messageApi.error(`Не удалось удалить: ${(error as Error).message}`);
    }
  };

  // The editor is in Russian even while the English version is edited.
  return (
    <ConfigProvider locale={ruRU}>
      <Modal
        open
        title={
          <>
            {(isNew && newTitles[section]) || titles[section]}{' '}
            <Text
              type="secondary"
              style={{ fontWeight: 'normal' }}
            >
              ·{' '}
              {isNew
                ? 'в обе версии, потом переведите английскую'
                : lang === 'ru'
                  ? 'русская версия'
                  : 'английская версия'}
            </Text>
          </>
        }
        okText={isNew ? 'Добавить' : 'Сохранить'}
        cancelText="Отмена"
        confirmLoading={saving}
        onOk={onSave}
        onCancel={onClose}
        footer={(buttons) => (
          <>
            {id && (
              <Popconfirm
                title="Удалить запись?"
                description="Она пропадёт и из русской, и из английской версии."
                okText="Удалить"
                okButtonProps={{ danger: true }}
                cancelText="Нет"
                onConfirm={onDelete}
              >
                <Button
                  danger
                  style={{ float: 'left' }}
                >
                  Удалить
                </Button>
              </Popconfirm>
            )}
            {buttons}
          </>
        )}
        width={640}
      >
        {messageContext}
        <Form
          form={form}
          layout="vertical"
          requiredMark
        >
          {fields[section].map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.kind === 'checkbox' ? undefined : labelFor(field)}
              extra={field.hint}
              rules={rulesFor(field)}
              valuePropName={field.kind === 'checkbox' ? 'checked' : 'value'}
            >
              {renderInput(field)}
            </Form.Item>
          ))}
        </Form>
        {section === 'certificates' &&
          (id ? (
            <CertificatePhotos
              certificateId={id}
              lang={lang}
            />
          ) : (
            <Text type="secondary">Фото можно будет добавить после того, как сертификат сохранится.</Text>
          ))}
      </Modal>
    </ConfigProvider>
  );
}
