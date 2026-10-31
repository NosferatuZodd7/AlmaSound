import { createInstance, type i18n } from 'i18next';

export interface LocaleFile {
  _meta: { name: string };
  [key: string]: unknown;
}

export interface LocaleInfo {
  /** BCP 47 code, taken from the file name (locales/pt-PT.json → "pt-PT"). */
  code: string;
  /** The language's own name, from the file's _meta.name. */
  name: string;
  resources: LocaleFile;
}

export const DEFAULT_LANGUAGE = 'en';

// Every JSON in locales/ is a language: adding a file is enough to list it (at build time).
const files = import.meta.glob<LocaleFile>('../../locales/*.json', { eager: true, import: 'default' });

export const LOCALES: readonly LocaleInfo[] = Object.entries(files)
  .map(([path, resources]) => ({ code: /([^/]+)\.json$/.exec(path)![1], name: resources._meta.name, resources }))
  .sort((a, b) => (a.code === DEFAULT_LANGUAGE ? -1 : b.code === DEFAULT_LANGUAGE ? 1 : a.name.localeCompare(b.name)));

/** Best available language for a request such as "pt-PT", "pt" or "pt-BR"; English otherwise. */
export function resolveLanguage(requested: string | undefined | null): string {
  if (!requested) return DEFAULT_LANGUAGE;
  const exact = LOCALES.find((l) => l.code.toLowerCase() === requested.toLowerCase());
  if (exact) return exact.code;
  const base = requested.split('-')[0].toLowerCase();
  return LOCALES.find((l) => l.code.split('-')[0].toLowerCase() === base)?.code ?? DEFAULT_LANGUAGE;
}

/** An i18next instance with every locale loaded and English as the fallback for missing keys. */
export function createI18n(language: string): i18n {
  const instance = createInstance();
  void instance.init({
    lng: resolveLanguage(language),
    fallbackLng: DEFAULT_LANGUAGE,
    resources: Object.fromEntries(LOCALES.map((l) => [l.code, { translation: l.resources }])),
    interpolation: { escapeValue: false }, // React and Electron menus escape on their own
    initAsync: false,
  });
  return instance;
}
