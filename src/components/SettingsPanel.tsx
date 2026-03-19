import React, { useState } from 'react';
import {
  Settings, Key, ExternalLink, CheckCircle2, XCircle,
  AlertTriangle, Github, RefreshCw, Server, Cpu, Lock, Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { isTrainualConfigured } from '../services/trainualService';

const GITHUB_REPO = 'https://github.com/devinbostwick/Trainual_Autograder';
const GITHUB_SECRETS_URL = `${GITHUB_REPO}/settings/secrets/actions`;
const GITHUB_ACTIONS_URL = `${GITHUB_REPO}/actions`;
const RENDER_URL = 'https://trainual-proxy.onrender.com';

// ─── Mini primitives ──────────────────────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
      {title}
    </h3>
    <div className="space-y-3">{children}</div>
  </div>
);

const StatusRow = ({
  label, value, ok, hint,
}: {
  label: string;
  value: string;
  ok: boolean | null; // null = neutral
  hint?: string;
}) => (
  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/60">
    <div className={cn(
      'mt-0.5 shrink-0',
      ok === true ? 'text-emerald-500' : ok === false ? 'text-rose-500' : 'text-muted-foreground'
    )}>
      {ok === true ? <CheckCircle2 className="w-4 h-4" /> : ok === false ? <XCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={cn(
          'text-xs font-mono px-2 py-0.5 rounded-md border shrink-0',
          ok === true ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
          : ok === false ? 'bg-rose-500/10 text-rose-700 border-rose-500/20'
          : 'bg-muted text-muted-foreground border-border/60'
        )}>
          {value}
        </span>
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  </div>
);

const LinkCard = ({
  icon, title, description, url, label,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  url: string;
  label: string;
}) => (
  <a
    href={url}
    target="_blank"
    rel="noopener noreferrer"
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

// ─── Main Component ───────────────────────────────────────────────────────────
export const SettingsPanel: React.FC = () => {
  const [proxyStatus, setProxyStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');

  const trainualConfigured = isTrainualConfigured();
  const proxyUrl: string = (process.env.TRAINUAL_PROXY as string) || '';
  const hasProxy = proxyUrl && proxyUrl !== 'undefined';
  const hasTrainualPw = !!(process.env.TRAINUAL_PASSWORD as string)?.length;
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY as string)?.length;
  // Claude key is obfuscated via parts — just check if env var is set
  const hasClaudeKey = !!(process.env.CLAUDE_KEY_PARTS as unknown as string[])?.length;

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
            View current configuration status. Secrets are managed via GitHub Actions — use the links below to update them.
          </p>
        </div>

        {/* Notice banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-8">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">GitHub Pages is a static host</p>
            <p className="text-xs text-amber-700 mt-0.5">
              API keys and secrets can't be edited at runtime — they're injected at build time via GitHub Actions secrets. To change a value, update the secret on GitHub, then re-run the deployment workflow.
            </p>
          </div>
        </div>

        {/* API Keys Status */}
        <Section title="API Keys & Secrets">
          <StatusRow
            label="Trainual Password"
            value={hasTrainualPw ? 'Set ✓' : 'Not set'}
            ok={hasTrainualPw}
            hint="Used to authenticate with the Trainual API via the proxy."
          />
          <StatusRow
            label="Trainual Proxy URL"
            value={hasProxy ? (proxyUrl.replace('https://', '').slice(0, 32) + '…') : 'Not set'}
            ok={hasProxy}
            hint="Points to the Render.com proxy server that forwards Trainual API calls."
          />
          <StatusRow
            label="Gemini API Key"
            value={hasGeminiKey ? 'Set ✓' : 'Not set'}
            ok={hasGeminiKey}
            hint="Used for factual/knowledge-based exam grading."
          />
          <StatusRow
            label="Claude API Key"
            value={hasClaudeKey ? 'Set ✓' : 'Not set'}
            ok={hasClaudeKey}
            hint="Used for scenario/conceptual exam grading."
          />
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

        {/* Quick Actions */}
        <Section title="Manage on GitHub">
          <LinkCard
            icon={<Key className="w-4 h-4" />}
            title="Edit Secrets"
            description="Update API keys, passwords, and proxy URL"
            url={GITHUB_SECRETS_URL}
            label="Open"
          />
          <LinkCard
            icon={<Github className="w-4 h-4" />}
            title="Re-run Deployment"
            description="Trigger a new build after changing a secret"
            url={GITHUB_ACTIONS_URL}
            label="Open"
          />
          <LinkCard
            icon={<Cpu className="w-4 h-4" />}
            title="Proxy Dashboard"
            description="Monitor the Render.com proxy server"
            url="https://dashboard.render.com"
            label="Open"
          />
        </Section>

        {/* Build info */}
        <div className="mt-2 p-4 rounded-xl bg-muted/40 border border-border/40">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">How updates work:</span>
            {' '}Go to <strong>GitHub → Settings → Secrets</strong>, update the value, then navigate to <strong>Actions</strong> and re-run the latest <em>Deploy</em> workflow. The new build will pick up the updated secret automatically — no code changes needed.
          </p>
        </div>

      </div>
    </div>
  );
};
