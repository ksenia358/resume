import type { KeyboardEvent, MouseEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import { AutoComplete, Button, Flex, Modal, Progress, Tag, theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { getExperience, getSkills } from '../../../../shared/api/resume';
import { useResumeSection } from '../../../../shared/hooks/useResumeSection';

const { Text } = Typography;

const MAX_SUGGESTIONS = 10;
// In combobox mode antd highlights an option that starts with the typed text, so Enter on "Java"
// would pick "JavaScript". Prefixed values never match the input, so Enter only picks what the user chose.
const OPTION_PREFIX = 'tech:';
const SEPARATOR = /[,;\n]/;
const INPUT_ID = 'tech-match-input';

interface EnteredTech {
  key: string;
  label: string;
  known: boolean;
}

// "Vue.js" / "vue js" / "VueJS" all compare equal.
function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s.\-_]/g, '');
}

// "Sass / SCSS", "Visual Studio (C#)" and "Vue.js" should also match "SCSS", "Visual Studio" and "Vue".
function aliasesOf(name: string): string[] {
  const withoutVendor = name.replace(/^JetBrains\s+/, '');
  const withoutNote = withoutVendor.replace(/\s*\(.*?\)\s*/g, '').trim();
  const parts = withoutNote.split('/').map((part) => part.trim());
  const withoutJs = parts.map((part) => part.replace(/\.js$/i, ''));
  return [name, withoutVendor, withoutNote, ...parts, ...withoutJs].filter(Boolean);
}

// Preselected so the visitor sees how tags and the match bar work; every frontend stack includes them.
const DEFAULT_TECHS: EnteredTech[] = [
  { key: 'html', label: 'HTML', known: true },
  { key: 'css', label: 'CSS', known: true },
];

const isDefaultSelection = (techs: EnteredTech[]) =>
  techs.length === DEFAULT_TECHS.length && DEFAULT_TECHS.every((tech) => techs.some((item) => item.key === tech.key));

interface TechMatchProps {
  // Receives the matched technologies once the modal closes; empty while the visitor hasn't changed the defaults.
  onApply: (matched: string[]) => void;
}

export function TechMatch({ onApply }: TechMatchProps) {
  const { t } = useTranslation();
  const { data: experience } = useResumeSection(getExperience);
  const { data: skills } = useResumeSection(getSkills);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [entered, setEntered] = useState<EnteredTech[]>(DEFAULT_TECHS);
  const selectedRef = useRef(false);
  const { token } = theme.useToken();

  const knownNames = useMemo(() => {
    const names = new Set<string>();
    experience.forEach((item) => item.technologies?.forEach((tech) => names.add(tech)));
    skills.forEach((tech) => names.add(tech));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [experience, skills]);

  const canonicalByAlias = useMemo(() => {
    const map = new Map<string, string>();
    knownNames.forEach((name) => aliasesOf(name).forEach((alias) => map.set(normalize(alias), name)));
    return map;
  }, [knownNames]);

  const query = normalize(input);
  const options = query
    ? knownNames
        .filter((name) => normalize(name).includes(query) && !entered.some((tech) => tech.label === name))
        .slice(0, MAX_SUGGESTIONS)
        .map((name) => ({ value: OPTION_PREFIX + name, label: name }))
    : [];

  const addTechs = (values: string[]) => {
    const additions = values
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const canonical = canonicalByAlias.get(normalize(value));
        const label = canonical ?? value;
        return { key: normalize(label), label, known: !!canonical };
      });

    setEntered((prev) => {
      const next = [...prev];
      additions.forEach((tech) => {
        if (!next.some((item) => item.key === tech.key)) next.push(tech);
      });
      return next;
    });
  };

  // The select event fires synchronously before our onKeyDown/onChange of the same event,
  // so the flag lets those skip it and is cleared right after.
  const onSelect = (value: string) => {
    selectedRef.current = true;
    queueMicrotask(() => {
      selectedRef.current = false;
    });
    addTechs([value.slice(OPTION_PREFIX.length)]);
    setInput('');
  };

  // Enter picks the highlighted suggestion (handled by onSelect); otherwise it adds the typed text as is.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || selectedRef.current) return;
    addTechs(input.split(SEPARATOR));
    setInput('');
  };

  // A typed or pasted list ("React, Vue, PHP") turns into tags as soon as a separator appears;
  // the unfinished last item stays in the input.
  const onChange = (value: string) => {
    if (selectedRef.current) return;
    const parts = value.split(SEPARATOR);
    const rest = parts.pop() ?? '';
    if (parts.length > 0) addTechs(parts);
    setInput(rest.trimStart());
  };

  const matchedCount = entered.filter((tech) => tech.known).length;
  const matchPercent = entered.length > 0 ? Math.round((matchedCount / entered.length) * 100) : 0;
  const matchColor =
    matchPercent >= 70 ? token.colorSuccess : matchPercent >= 40 ? token.colorWarning : token.colorError;

  const close = () => {
    setOpen(false);
    onApply(isDefaultSelection(entered) ? [] : entered.filter((tech) => tech.known).map((tech) => tech.label));
  };

  const reset = () => {
    setEntered([]);
    setInput('');
  };

  return (
    <>
      <a
        href="#"
        role="button"
        onClick={(event: MouseEvent) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {t('techMatch.link')}
      </a>

      <Modal
        open={open}
        footer={
          <Flex gap={8}>
            <Button
              block
              onClick={reset}
              size={'large'}
            >
              {t('techMatch.reset')}
            </Button>
            <Button
              block
              type="primary"
              onClick={close}
              size={'large'}
            >
              {t('techMatch.ok')}
            </Button>
          </Flex>
        }
        onCancel={close}
      >
        <h2>{t('techMatch.title')}</h2>
        <label
          htmlFor={INPUT_ID}
          style={{ display: 'block', marginBottom: 8 }}
        >
          {t('techMatch.label')}
        </label>
        <AutoComplete
          size={'large'}
          id={INPUT_ID}
          value={input}
          placeholder={t('techMatch.label')}
          options={options}
          onChange={onChange}
          onSelect={onSelect}
          onKeyDown={onKeyDown}
          defaultActiveFirstOption={false}
          style={{ width: '100%' }}
          autoFocus
        />
        {entered.length > 0 && (
          <>
            <Progress
              percent={matchPercent}
              strokeColor={matchColor}
              style={{ marginTop: 12, marginBottom: 0 }}
            />
            <Flex
              wrap
              gap={4}
              style={{ marginTop: 12 }}
            >
              {entered.map((tech) => (
                <Tag
                  key={tech.key}
                  color={tech.known ? 'success' : 'error'}
                  closable
                  onClose={() => setEntered((prev) => prev.filter((item) => item.key !== tech.key))}
                  style={{ marginInlineEnd: 0 }}
                >
                  {tech.label}
                </Tag>
              ))}
            </Flex>
            <Text
              type="secondary"
              style={{ display: 'block', marginTop: 12 }}
            >
              {t('techMatch.summary', { matched: matchedCount, total: entered.length })}
            </Text>
          </>
        )}
      </Modal>
    </>
  );
}
