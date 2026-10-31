import { describe, expect, it } from 'vitest';
import { compareVersions, parseVersion } from '../../src/core/updates/version';
import { describeNothingNew, normalizeChannel, parseReleases, parseSha256File, pick, resolveRepository } from '../../src/core/updates/releases';

// Canned GitHub API data (no network).
const HASH_SETUP = 'a'.repeat(64);
const HASH_PORTABLE = 'b'.repeat(64);

function release(tag: string, opts: { prerelease?: boolean; draft?: boolean; body?: string; assets?: string[] } = {}) {
  return {
    tag_name: tag,
    name: `AlmaSound ${tag}`,
    body: opts.body ?? '',
    html_url: `https://github.com/o/r/releases/tag/${tag}`,
    prerelease: opts.prerelease ?? false,
    draft: opts.draft ?? false,
    assets: (opts.assets ?? []).map((name, i) => ({ name, size: 1000 + i, browser_download_url: `https://github.com/o/r/releases/download/${tag}/${name}` })),
  };
}

describe('versions', () => {
  it('parses with or without v and with a prerelease', () => {
    expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
    expect(parseVersion('1.2.3-dev.4')).toEqual({ major: 1, minor: 2, patch: 3, pre: ['dev', '4'] });
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('dev')).toBeNull();
  });

  it('orders like semver', () => {
    expect(compareVersions('1.2.3-dev.9', '1.2.3-dev.10')).toBe(-1);
    expect(compareVersions('1.2.3-dev.4', '1.2.3')).toBe(-1);
    expect(compareVersions('1.2.3', '1.2.4-dev.1')).toBe(-1);
    expect(compareVersions('v1.4.0', '1.4.0')).toBe(0);
    expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1); // numeric before text
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1); // shorter first
    expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
  });

  it('treats invalid versions as the oldest', () => {
    expect(compareVersions('garbage', '0.0.1-dev.1')).toBe(-1);
    expect(compareVersions('0.0.1', '')).toBe(1);
    expect(compareVersions('x', 'y')).toBe(0);
  });
});

describe('parseReleases', () => {
  const json = [
    release('v1.1.0', { draft: true, assets: ['AlmaSound-1.1.0-setup.exe'] }),
    { name: 'no tag' },
    release('v1.0.0', {
      body: `Notes\n\`${HASH_SETUP}\`  AlmaSound-1.0.0-setup.exe\n\`${HASH_PORTABLE}\`  AlmaSound-1.0.0-portable.exe`,
      assets: ['AlmaSound-1.0.0-portable.exe', 'AlmaSound-1.0.0-portable.exe.sha256', 'AlmaSound-1.0.0-setup.exe', 'AlmaSound-1.0.0-setup.exe.sha256'],
    }),
  ];

  it('skips drafts and entries without a tag', () => {
    expect(parseReleases(json, '-setup.exe').map((r) => r.tag)).toEqual(['v1.0.0']);
  });

  it('picks the asset by suffix with its own hash, from the body and the .sha256 asset', () => {
    const [r] = parseReleases(json, '-setup.exe');
    expect(r.assetName).toBe('AlmaSound-1.0.0-setup.exe');
    expect(r.assetSize).toBe(1002);
    expect(r.assetSha256).toBe(HASH_SETUP);
    expect(r.assetSha256Url).toMatch(/AlmaSound-1\.0\.0-setup\.exe\.sha256$/);
  });

  it('does not take another file’s hash', () => {
    const [r] = parseReleases([release('v2.0.0', { assets: ['App-2.0.0-setup.exe', 'App-2.0.0-portable.exe.sha256'] })], '-setup.exe');
    expect(r.assetSha256Url).toBe('');
    expect(r.assetSha256).toBe('');
  });

  it('accepts a single object and has no asset without a suffix', () => {
    const [r] = parseReleases(release('v3.0.0', { assets: ['a-setup.exe'] }), '');
    expect(r.tag).toBe('v3.0.0');
    expect(r.assetName).toBe('');
  });

  it('reads a sha256sum line', () => {
    expect(parseSha256File(`${HASH_SETUP.toUpperCase()}  file.exe\n`)).toBe(HASH_SETUP);
    expect(parseSha256File('nope')).toBeNull();
  });
});

describe('pick and messages', () => {
  const releases = parseReleases(
    [release('v1.3.0'), release('v1.4.0-dev.12', { prerelease: true }), release('v1.4.0-dev.9', { prerelease: true }), release('not-a-version')],
    '-setup.exe',
  );

  it('Stable ignores prereleases; Testing takes the highest', () => {
    expect(pick(releases, 'stable', '1.2.0')?.tag).toBe('v1.3.0');
    expect(pick(releases, 'testing', '1.2.0')?.tag).toBe('v1.4.0-dev.12');
  });

  it('offers nothing when equal or older', () => {
    expect(pick(releases, 'stable', '1.3.0')).toBeNull();
    expect(pick(releases, 'testing', '1.4.0')).toBeNull();
  });

  it('an invalid installed version accepts any valid release', () => {
    expect(pick(releases, 'stable', 'unknown')?.tag).toBe('v1.3.0');
  });

  it('on Stable, mentions a newer test build', () => {
    expect(describeNothingNew(releases, 'stable', '1.3.0')).toEqual({ key: 'updates.testingAvailable', params: { version: 'v1.4.0-dev.12' } });
    expect(describeNothingNew(releases, 'stable', '1.4.0')).toEqual({ key: 'updates.upToDateStable' });
    expect(describeNothingNew(releases, 'testing', '1.4.0')).toEqual({ key: 'updates.upToDateTesting' });
  });

  it('normalises channel aliases', () => {
    expect(normalizeChannel('beta')).toBe('testing');
    expect(normalizeChannel('stable')).toBe('stable');
    expect(normalizeChannel(42)).toBe('stable');
  });
});

describe('repository resolution', () => {
  it('follows the new compiled default unless the user wrote one', () => {
    expect(resolveRepository(undefined, undefined, 'new/repo')).toBe('new/repo');
    expect(resolveRepository('old/repo', 'old/repo', 'new/repo')).toBe('new/repo');
    expect(resolveRepository('mine/fork', 'old/repo', 'new/repo')).toBe('mine/fork');
  });
});
