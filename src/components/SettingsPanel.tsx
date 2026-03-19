import React, { useState, useEffect } from 'react';
import {
  Settings, Key, ExternalLink, CheckCircle2, XCircle,
  AlertTriangle, Github, RefreshCw, Server, Cpu, Lock,
  Info, Eye, EyeOff, Save, RotateCcw, ShieldCheck, LogOut, Edit3
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getConfig, setConfig, isOverridden, ConfigKey } from '../services/localConfig';

const GITHUB_REPO = 'https://github.com/Three-Points-Hospitality-Group/training-dashboard';
const GITHUB_SECRETS_URL = `${GITHUB_REPO}/settings/secrets/actions`;
const GITHUB_ACTIONS_URL = `${GITHUB_REPO}/actions`;
const RENDER_URL = 'https://trainual-proxy.onrender.com';
const ADMIN_PASSCODE = (process.env.ADMIN_PASSWORD as string) || '196396';

// ─── Mini primitives ──────────────────────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
      {title}
    </h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const LinkCard = ({
  icon, title, description, url, label,
}: {
  icon: React.ReactNode; title: string; description: string; url: string; label: string;
}) => (
  <a
    href={url} target="_blank" rel="noopener noreferrer"
    className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all group"
  >
    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
    </div>
    <div className="flex items-center gap-1.5 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
      {label} <ExternalLink className="w-3 h-3" />
    </div>
  </a>
);

// ─── Editable config row (admin only) ─────────────────────────────────────────
const CONFIG_META: { key: ConfigKey; label: string; hint: string; sensitive: boolean }[] = [
  { key: 'TRAINUAL_PASSWORD', label: 'Trainual Password',   hint: 'Authenticates with the Trainual API via the proxy.',           sensitive: true  },
  { key: 'TRAINUAL_PROXY',    label: 'Trainual Proxy URL',  hint: 'Render.com proxy that forwards Trainual API calls.',            sensitive: false },
  { key: 'GEMINI_API_KEY',    label: 'Gemini API Key',      hint: 'Used for factual/knowledge-based exam grading.',               sensitive: true  },
  { key: 'CLAUDE_API_KEY',    label: 'Claude API Key',      hint: 'Used for scenario/conceptual exam grading.',                   sensitive: true  },
];

function EditableConfigRow({ configKey, label, hint, sensitive }: {
  configKey: ConfigKey; label: string; hint: string; sensitive: boolean;
}) {
  const current = getConfig(configKey);
  const overridden = isOverridden(configKey);
  const [draft, setDraft] = useState(current);
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = draft !== current;

  const handleSave = () => {
    setConfig(configKey, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setConfig(configKey, '');
    setDraft('');
  };

  const displayValue = sensitive && !show
    ? (draft.length > 0 ? '•'.repeat(Math.min(draft.length, 24)) : '')
    : draft;

  return (
    <div className="p-4 rounded-xl bg-card border border-border/60 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {overridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 font-medium">
              local override
            </span>
          )}
          {!overridden && current.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 font-medium">
              from build
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {current.length > 0
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
          <span className={cn('text-xs font-medium', current.length > 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {current.length > 0 ? 'Set' : 'Not set'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={sensitive && !show ? 'password' : 'text'}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder={`Enter ${label}…`}
            className="w-full px-3 py-2 pr-8 text-xs font-mono bg-background border border-border/60 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
          {sensitive && (
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty && !saved}
          className={cn(
            'shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
            saved
              ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
              : isDirty
                ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                : 'bg-muted text-muted-foreground border-border/60 opacity-50 cursor-not-allowed'
          )}
        >
          {saved ? <><CheckCircle2 className="w-3 h-3" /> Saved</> : <><Save className="w-3 h-3" /> Save</>}
        </button>
        {overridden && (
          <button
            onClick={handleClear}
            title="Clear override — revert to build-time value"
            className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium border border-border/60 bg-muted text-muted-foreground hover:bg-rose-500/10 hover:text-rose-700 hover:border-rose-500/20 transition-all"
          >
            <RotateCcw className="w-3 h-3" /> Revert
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

// ─── Passcode lock ─────────────────────────────────────────────────────────────
function PasscodeLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const attempt = () => {
    if (code === ADMIN_PASSCODE) {
      onUnlock();
    } else {
      setError(true);
      setCode('');
      setTimeout(() => setError(false), 1800);
    }
  };

  return (
    <div className={cn(
      'p-6 rounded-2xl border transition-all',
      error
        ? 'bg-rose-500/5 border-rose-500/30'
        : 'bg-card border-border/60'
    )}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Admin Access Required</p>
          <p className="text-xs text-muted-foreground">Enter the admin passcode to edit configuration</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={code}
          onChange={e => { setCode(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="Passcode"
          autoFocus
          className={cn(
            'flex-1 px-3 py-2 text-sm bg-background border rounded-lg outline-none transition-all focus:ring-2',
            error
              ? 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-400'
              : 'border-border/60 focus:ring-primary/20 focus:border-primary'
          )}
        />
        <button
          onClick={attempt}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Unlock
        </button>
      </div>
      {error && (
        <p className="text-xs text-rose-600 mt-2 font-medium">Incorrect passcode — try again.</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const SettingsPanel: React.FC = () => {
  const [proxyStatus, setProxyStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  // Re-read on every render so status rows stay fresh after edits
  const hasTrainualPw  = getConfig('TRAINUAL_PASSWORD').length > 0;
  const proxyUrl       = getConfig('TRAINUAL_PROXY');
  const hasProxy       = proxyUrl.length > 0 && proxyUrl !== 'undefined';
  const hasGeminiKey   = getConfig('GEMINI_API_KEY').length > 0;
  const hasClaudeKey   = getConfig('CLAUDE_API_KEY').length > 0;

  const checkProxy = async () => {
    setProxyStatus('checking');
    try {
      const res = await fetch(`${RENDER_URL}/health`, { signal: AbortSignal.timeout(6000) });
      setProxyStatus(res.ok ? 'ok' : 'error');
    } catch {
      setProxyStatus('error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-2xl mx-auto px-8 py-10">

        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Settings className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Configuration</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View status and manage API keys. Use the admin panel below to edit values — they're saved locally in your browser and take effect immediately.
          </p>
        </div>

        {/* Status Summary */}
        <Section title="API Keys & Secrets">
          {[
            { label: 'Trainual Password', ok: hasTrainualPw, hint: 'Authenticates with the Trainual API via the proxy.' },
            { label: 'Trainual Proxy URL', ok: hasProxy, hint: proxyUrl && proxyUrl !== 'undefined' ? proxyUrl.replace('https://', '').slice(0, 40) : 'Not configured' },
            { label: 'Gemini API Key', ok: hasGeminiKey, hint: 'Used for factual/knowledge-based exam grading.' },
            { label: 'Claude API Key', ok: hasClaudeKey, hint: 'Used for scenario/conceptual exam grading.' },
          ].map(({ label, ok, hint }) => (
            <div key={label} className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/60">
              <div className={cn('mt-0.5 shrink-0', ok ? 'text-emerald-500' : 'text-rose-500')}>
                {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className={cn(
                    'text-xs font-mono px-2 py-0.5 rounded-md border shrink-0',
                    ok ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                       : 'bg-rose-500/10 text-rose-700 border-rose-500/20'
                  )}>
                    {ok ? 'Set ✓' : 'Not set'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{hint}</p>
              </div>
            </div>
          ))}
        </Section>

        {/* Proxy Health */}
        <Section title="Proxy Health">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/60">
            <Server className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">Render.com Proxy</div>
              <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{RENDER_URL}</div>
            </div>
            {proxyStatus === 'ok' && <span className="text-xs text-emerald-600 font-medium">Online ✓</span>}
            {proxyStatus === 'error' && <span className="text-xs text-rose-600 font-medium">Offline ✗</span>}
            <button
              onClick={checkProxy}
              disabled={proxyStatus === 'checking'}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/80 text-xs font-medium text-foreground border border-border/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3 h-3', proxyStatus === 'checking' && 'animate-spin')} />
              {proxyStatus === 'checking' ? 'Checking…' : 'Ping'}
            </button>
          </div>
        </Section>

        {/* ── Admin Panel ──────────────────────────────────────────────────── */}
        <div className="mt-2 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {adminUnlocked
                ? <ShieldCheck className="w-4 h-4 text-emerald-500" />
                : <Lock className="w-4 h-4 text-muted-foreground" />}
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Admin Panel
              </h3>
              {adminUnlocked && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-medium">
                  Unlocked
                </span>
              )}
            </div>
            {adminUnlocked && (
              <button
                onClick={() => setAdminUnlocked(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="w-3 h-3" /> Lock
              </button>
            )}
          </div>

          {adminUnlocked ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 mb-4">
                <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Values saved here are stored in your browser's <strong>localStorage</strong> and override the build-time secrets — no rebuild needed. They persist across refreshes but are specific to this browser.
                </p>
              </div>
              {CONFIG_META.map(m => (
                <EditableConfigRow key={m.key} configKey={m.key} label={m.label} hint={m.hint} sensitive={m.sensitive} />
              ))}
            </div>
          ) : (
            <PasscodeLock onUnlock={() => setAdminUnlocked(true)} />
          )}
        </div>

        {/* Quick Actions */}
        <Section title="Manage on GitHub">
          <LinkCard icon={<Key className="w-4 h-4" />} title="Edit Secrets" description="Update build-time API keys and passwords" url={GITHUB_SECRETS_URL} label="Open" />
          <LinkCard icon={<Github className="w-4 h-4" />} title="Re-run Deployment" description="Trigger a new build after changing a secret" url={GITHUB_ACTIONS_URL} label="Open" />
          <LinkCard icon={<Cpu className="w-4 h-4" />} title="Proxy Dashboard" description="Monitor the Render.com proxy server" url="https://dashboard.render.com" label="Open" />
        </Section>

      </div>
    </div>
  );
};
