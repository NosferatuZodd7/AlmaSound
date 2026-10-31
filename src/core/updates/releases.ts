import { compareVersions, parseVersion } from './version';

export type Channel = 'stable' | 'testing';

export interface ReleaseInfo {
  tag: string;
  name: string;
  /** Release notes (markdown). */
  notes: string;
  pageUrl: string;
  prerelease: boolean;
  /** Installer for this platform; empty when the release has none (only the page is offered). */
  assetName: string;
  assetUrl: string;
  assetSize: number;
  /** Hash found in the release body (lower case), or empty. */
  assetSha256: string;
  /** URL of "<assetName>.sha256", or empty. */
  assetSha256Url: string;
}

/** A translatable message: a locale key plus its parameters. */
export interface UpdateMessage {
  key: string;
  params?: Record<string, string | number>;
}

const SHA256_RE = /\b[0-9a-fA-F]{64}\b/;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Reads GitHub's releases JSON (an array, or one object as /releases/latest returns). Skips drafts
 * and entries without a tag. Picks this platform's installer by file-name suffix and its own
 * .sha256 (never another file's).
 */
export function parseReleases(json: unknown, assetSuffix: string): ReleaseInfo[] {
  const list = Array.isArray(json) ? json : json && typeof json === 'object' ? [json] : [];
  const releases: ReleaseInfo[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const tag = str(r.tag_name);
    if (r.draft === true || !tag) continue;
    const assets = (Array.isArray(r.assets) ? r.assets : []) as Record<string, unknown>[];
    const hashUrls = new Map<string, string>();
    for (const a of assets) {
      const name = str(a.name).toLowerCase();
      if (name.endsWith('.sha256')) hashUrls.set(name, str(a.browser_download_url));
    }
    const suffix = assetSuffix.toLowerCase();
    const asset = suffix ? assets.find((a) => str(a.name).toLowerCase().endsWith(suffix)) : undefined;
    const assetName = asset ? str(asset.name) : '';
    const notes = str(r.body);
    releases.push({
      tag,
      name: str(r.name) || tag,
      notes,
      pageUrl: str(r.html_url),
      prerelease: r.prerelease === true,
      assetName,
      assetUrl: asset ? str(asset.browser_download_url) : '',
      assetSize: asset && typeof asset.size === 'number' ? asset.size : 0,
      assetSha256: assetName ? hashInBody(notes, assetName) : '',
      assetSha256Url: assetName ? (hashUrls.get(`${assetName.toLowerCase()}.sha256`) ?? '') : '',
    });
  }
  return releases;
}

/** A line naming the asset with a 64-hex-digit word on it. */
function hashInBody(body: string, assetName: string): string {
  for (const line of body.split(/\r?\n/)) {
    if (!line.includes(assetName)) continue;
    const m = SHA256_RE.exec(line);
    if (m) return m[0].toLowerCase();
  }
  return '';
}

/** First word of a sha256sum line, if it is a SHA-256 hex digest. */
export function parseSha256File(text: string): string | null {
  const word = text.trim().split(/\s+/)[0] ?? '';
  return /^[0-9a-fA-F]{64}$/.test(word) ? word.toLowerCase() : null;
}

/** The newest release the channel allows, only if strictly newer than the installed version. */
export function pick(releases: readonly ReleaseInfo[], channel: Channel, currentVersion: string): ReleaseInfo | null {
  let best: ReleaseInfo | null = null;
  for (const r of releases) {
    if ((channel === 'stable' && r.prerelease) || !parseVersion(r.tag)) continue;
    if (!best || compareVersions(r.tag, best.tag) > 0) best = r;
  }
  return best && compareVersions(best.tag, currentVersion) > 0 ? best : null;
}

/** What to say when nothing new was found; on Stable, mentions a newer test build if there is one. */
export function describeNothingNew(releases: readonly ReleaseInfo[], channel: Channel, currentVersion: string): UpdateMessage {
  if (channel === 'testing') return { key: 'updates.upToDateTesting' };
  const test = pick(releases, 'testing', currentVersion);
  return test ? { key: 'updates.testingAvailable', params: { version: test.tag } } : { key: 'updates.upToDateStable' };
}

/** Accepts legacy aliases ("beta", "dev") for Testing. */
export function normalizeChannel(value: unknown): Channel {
  return value === 'testing' || value === 'beta' || value === 'dev' ? 'testing' : 'stable';
}

/**
 * The repository to use. If the stored value equals the default that was compiled in when it was
 * saved, the user never chose it, so the new build's default wins (projects can move).
 */
export function resolveRepository(stored: string | undefined, storedDefault: string | undefined, compiledDefault: string): string {
  return stored === undefined || stored === storedDefault ? compiledDefault : stored;
}

export const isRepositoryName = (repo: string): boolean => /^[\w.-]+\/[\w.-]+$/.test(repo);
