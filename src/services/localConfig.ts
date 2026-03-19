/**
 * localConfig — runtime-editable config stored in localStorage.
 *
 * Priority order for each key:
 *   1. localStorage override (set via Settings panel)
 *   2. Build-time env var (injected by GitHub Actions / vite.config.ts)
 *
 * This lets the dashboard work without a rebuild when keys change.
 * Values are stored under the LS_PREFIX namespace so they're easy to find/clear.
 */

const LS_PREFIX = 'tph_autograde_';

export type ConfigKey =
  | 'TRAINUAL_PASSWORD'
  | 'TRAINUAL_PROXY'
  | 'GEMINI_API_KEY'
  | 'CLAUDE_API_KEY';

const ENV_FALLBACKS: Record<ConfigKey, string> = {
  TRAINUAL_PASSWORD: process.env.TRAINUAL_PASSWORD as string || '',
  TRAINUAL_PROXY:    process.env.TRAINUAL_PROXY as string    || '',
  GEMINI_API_KEY:    process.env.GEMINI_API_KEY as string    || '',
  CLAUDE_API_KEY:    process.env.CLAUDE_API_KEY as string    || '',
};

function lsKey(k: ConfigKey) {
  return `${LS_PREFIX}${k}`;
}

/** Read a config value — localStorage first, then build-time env. */
export function getConfig(key: ConfigKey): string {
  try {
    const stored = localStorage.getItem(lsKey(key));
    if (stored && stored.length > 0) return stored;
  } catch {}
  const env = ENV_FALLBACKS[key];
  return (env && env !== 'undefined') ? env : '';
}

/** Write a config value to localStorage. Pass '' to clear (fall back to env). */
export function setConfig(key: ConfigKey, value: string): void {
  try {
    if (value && value.trim().length > 0) {
      localStorage.setItem(lsKey(key), value.trim());
    } else {
      localStorage.removeItem(lsKey(key));
    }
  } catch {}
}

/** Check whether a key has any value (localStorage or env). */
export function hasConfig(key: ConfigKey): boolean {
  return getConfig(key).length > 0;
}

/** Returns true if the value is coming from localStorage (user-set). */
export function isOverridden(key: ConfigKey): boolean {
  try {
    const stored = localStorage.getItem(lsKey(key));
    return !!stored && stored.length > 0;
  } catch { return false; }
}

/** Clear all localStorage overrides (revert to build-time env). */
export function clearAllOverrides(): void {
  (['TRAINUAL_PASSWORD', 'TRAINUAL_PROXY', 'GEMINI_API_KEY', 'CLAUDE_API_KEY'] as ConfigKey[])
    .forEach(k => { try { localStorage.removeItem(lsKey(k)); } catch {} });
}
