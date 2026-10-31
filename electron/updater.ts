import { app, net, shell } from 'electron';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import {
  describeNothingNew,
  isRepositoryName,
  parseReleases,
  parseSha256File,
  pick,
  type Channel,
  type ReleaseInfo,
  type UpdateMessage,
} from '../src/core/updates/releases';
import type { UpdateState, UpdateStatus } from './ipc';

export interface UpdaterConfig {
  repository: string;
  channel: Channel;
}

const TIMEOUT_MS = 15_000;
/** Only Windows ships a self-installer; elsewhere "Install" opens the release page. */
const ASSET_SUFFIX = process.platform === 'win32' ? '-setup.exe' : '';
const GITHUB = 'https://github.com/';

/**
 * Finds, verifies and installs updates from the repository's GitHub Releases (anonymous read of
 * the public API, no token). Never installs without the user pressing Install. One operation at
 * a time; results go to the renderer through `emit`.
 */
export class Updater {
  private _busy = false;
  private _release: ReleaseInfo | null = null;
  private _status: UpdateStatus;

  constructor(
    private readonly _config: () => UpdaterConfig,
    private readonly _emit: (status: UpdateStatus, notify: boolean) => void,
    private readonly _apiBase = 'https://api.github.com',
  ) {
    this._status = { state: 'idle', message: null, currentVersion: app.getVersion(), release: null, progress: 0 };
  }

  get status(): UpdateStatus {
    return this._status;
  }

  /** `manual`: results are always reported; otherwise only a new version pops up. */
  async check(manual: boolean): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    try {
      this._set('checking', null, manual);
      const { repository, channel } = this._config();
      if (!isRepositoryName(repository)) return this._set('error', { key: 'updates.notSet' }, manual);

      let res: Response;
      try {
        res = await net.fetch(`${this._apiBase}/repos/${repository}/releases?per_page=20`, {
          headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        return this._set('error', { key: 'updates.unreachable', params: { error: errorText(e) } }, manual);
      }
      if (res.status === 404) return this._set('error', { key: 'updates.notFound', params: { repo: repository } }, manual);
      if (res.status === 403 || res.status === 429) return this._set('error', { key: 'updates.rateLimited' }, manual);
      if (!res.ok) return this._set('error', { key: 'updates.httpError', params: { status: res.status } }, manual);

      let releases: ReleaseInfo[];
      try {
        releases = parseReleases(await res.json(), ASSET_SUFFIX);
      } catch {
        return this._set('error', { key: 'updates.badResponse' }, manual);
      }
      if (releases.length === 0) return this._set('up-to-date', { key: 'updates.noReleases' }, manual);

      const current = this._status.currentVersion;
      const found = pick(releases, channel, current);
      if (!found) return this._set('up-to-date', describeNothingNew(releases, channel, current), manual);
      this._offer(found);
    } finally {
      this._busy = false;
    }
  }

  /** Loads a canned release into "available", to see the dialog without publishing anything. */
  demo(): void {
    this._offer({
      tag: 'v9.9.9',
      name: 'AlmaSound v9.9.9 (demo)',
      notes: 'Demo release notes.\n\n- Sampled instruments\n- Track mixer',
      pageUrl: `${GITHUB}NosferatuZodd7/AlmaSound/releases`,
      prerelease: false,
      assetName: '',
      assetUrl: '',
      assetSize: 0,
      assetSha256: '',
      assetSha256Url: '',
    });
  }

  async install(): Promise<void> {
    const r = this._release;
    if (this._busy || !r) return;
    if (!r.assetUrl) return this.openPage();
    if (!/^[\w.-]+$/.test(r.assetName) || !r.assetUrl.startsWith(GITHUB)) {
      return this._set('error', { key: 'updates.downloadFailed', params: { error: 'unexpected asset' } }, true);
    }
    this._busy = true;
    try {
      // Get the expected hash before downloading tens of MB with nothing to compare against.
      let expected = r.assetSha256;
      if (!expected && r.assetSha256Url) {
        try {
          const res = await net.fetch(r.assetSha256Url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
          expected = (res.ok && parseSha256File(await res.text())) || '';
        } catch {
          expected = '';
        }
        if (!expected) return this._set('error', { key: 'updates.hashUnreadable' }, true);
      }

      const file = join(app.getPath('temp'), r.assetName);
      let actual: string;
      try {
        actual = await this._download(r, file);
      } catch (e) {
        await unlink(file).catch(() => undefined);
        return this._set('error', { key: 'updates.downloadFailed', params: { error: errorText(e) } }, true);
      }

      if (expected && actual !== expected) {
        await unlink(file).catch(() => undefined);
        console.error(`Update ${r.assetName}: SHA-256 mismatch, expected ${expected}, got ${actual}`);
        return this._set('error', { key: 'updates.mismatch' }, true);
      }
      if (!expected) console.warn(`Update ${r.assetName}: no SHA-256 published; only HTTPS vouched for the file`);

      this._set('ready', { key: 'updates.ready' }, true);
      try {
        // A running exe cannot be replaced: start the installer on its own, then quit.
        const child = spawn(file, [], { detached: true, stdio: 'ignore' });
        child.on('error', () => this._set('error', { key: 'updates.launchFailed', params: { path: file } }, true));
        child.unref();
        child.once('spawn', () => setTimeout(() => app.quit(), 500));
      } catch {
        this._set('error', { key: 'updates.launchFailed', params: { path: file } }, true);
      }
    } finally {
      this._busy = false;
    }
  }

  async openPage(): Promise<void> {
    const url = this._release?.pageUrl;
    if (url?.startsWith(GITHUB)) await shell.openExternal(url);
  }

  /** Streams the asset to `file`, reporting progress, and returns its SHA-256. */
  private async _download(r: ReleaseInfo, file: string): Promise<string> {
    const res = await net.fetch(r.assetUrl);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || r.assetSize;
    const hash = createHash('sha256');
    const out = createWriteStream(file);
    let received = 0;
    let lastReported = 0;
    this._setProgress(0);
    try {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
        if (!out.write(value)) await new Promise((resolve) => out.once('drain', resolve));
        received += value.length;
        const progress = total ? Math.min(1, received / total) : 0;
        if (progress - lastReported >= 0.01) this._setProgress((lastReported = progress));
      }
    } finally {
      await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    }
    return hash.digest('hex');
  }

  private _offer(release: ReleaseInfo): void {
    this._release = release;
    this._status = {
      ...this._status,
      state: 'available',
      message: { key: 'updates.available', params: { version: release.tag } },
      release: { tag: release.tag, name: release.name, notes: release.notes, pageUrl: release.pageUrl, hasInstaller: !!release.assetUrl },
      progress: 0,
    };
    this._emit(this._status, true);
  }

  private _setProgress(progress: number): void {
    this._status = { ...this._status, state: 'downloading', message: null, progress };
    this._emit(this._status, false);
  }

  private _set(state: UpdateState, message: UpdateMessage | null, notify: boolean): void {
    const keepsRelease = state === 'downloading' || state === 'ready' || (state === 'error' && this._status.release !== null);
    this._status = { ...this._status, state, message, release: keepsRelease ? this._status.release : null };
    if (!keepsRelease) this._release = null;
    this._emit(this._status, notify);
  }
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
