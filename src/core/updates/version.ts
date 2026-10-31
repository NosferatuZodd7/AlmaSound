/** Semantic version: MAJOR.MINOR.PATCH with optional prerelease identifiers (e.g. "dev.12"). */
export interface Version {
  major: number;
  minor: number;
  patch: number;
  /** Prerelease identifiers split on "."; empty for a final release. */
  pre: string[];
}

const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/** Accepts "v1.2.3", "1.2.3" and "1.2.3-dev.4"; returns null for anything else. */
export function parseVersion(text: string): Version | null {
  const m = VERSION_RE.exec(text.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split('.') : [] };
}

const isNumeric = (s: string) => /^\d+$/.test(s);

function comparePre(a: string[], b: string[]): number {
  // A prerelease comes before its final version.
  if (a.length === 0 || b.length === 0) return a.length === b.length ? 0 : a.length === 0 ? 1 : -1;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    const nx = isNumeric(x);
    const ny = isNumeric(y);
    if (nx && ny) return Math.sign(Number(x) - Number(y));
    if (nx !== ny) return nx ? -1 : 1; // numeric identifiers sort before text
    return x < y ? -1 : 1;
  }
  return Math.sign(a.length - b.length);
}

/** Semver ordering. Invalid versions count as the oldest possible. Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return va ? 1 : vb ? -1 : 0;
  return Math.sign(va.major - vb.major) || Math.sign(va.minor - vb.minor) || Math.sign(va.patch - vb.patch) || comparePre(va.pre, vb.pre);
}
