import { describe, expect, it } from 'vitest';
import { LOCALES, createI18n, resolveLanguage } from '../../src/i18n/locales';
import { formatDuration, formatNumber } from '../../src/i18n/format';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

const byCode = (code: string) => LOCALES.find((l) => l.code === code)!;

describe('locales', () => {
  it('discovers en and pt-PT from locales/, English first', () => {
    expect(LOCALES[0].code).toBe('en');
    expect(LOCALES.map((l) => l.code)).toContain('pt-PT');
    for (const l of LOCALES) expect(l.name.length, l.code).toBeGreaterThan(0);
  });

  it('pt-PT has exactly the same keys as en', () => {
    expect(keys(byCode('pt-PT').resources).sort()).toEqual(keys(byCode('en').resources).sort());
  });

  it('no locale has keys that en lacks', () => {
    const reference = new Set(keys(byCode('en').resources));
    for (const l of LOCALES) expect(keys(l.resources).filter((k) => !reference.has(k)), l.code).toEqual([]);
  });

  it('every locale keeps the same {{placeholders}} as en', () => {
    const placeholders = (s: unknown) => (typeof s === 'string' ? (s.match(/{{\w+}}/g) ?? []).sort() : []);
    const en = createI18n('en');
    for (const l of LOCALES) {
      const t = createI18n(l.code);
      for (const k of keys(byCode('en').resources)) expect(placeholders(t.t(k)), `${l.code} ${k}`).toEqual(placeholders(en.t(k)));
    }
  });

  it('resolves requested languages with English as fallback', () => {
    expect(resolveLanguage('pt-PT')).toBe('pt-PT');
    expect(resolveLanguage('pt')).toBe('pt-PT');
    expect(resolveLanguage('pt-BR')).toBe('pt-PT');
    expect(resolveLanguage('de-DE')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });

  it('translates and falls back to English for a missing key', () => {
    expect(createI18n('pt-PT').t('transport.play')).toBe('Tocar');
    const t = createI18n('pt-PT');
    t.addResource('en', 'translation', 'only.inEnglish', 'English text');
    expect(t.t('only.inEnglish')).toBe('English text');
  });
});

describe('format', () => {
  it('uses the locale decimal separator', () => {
    expect(formatDuration(65.34, 'en')).toBe('1:05.3');
    expect(formatDuration(65.34, 'pt-PT')).toBe('1:05,3');
    expect(formatNumber(1.5, 'pt-PT', 2)).toBe('1,50');
  });
});
