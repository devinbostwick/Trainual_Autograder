import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';

const BASE = import.meta.env.BASE_URL || '/';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-white/80 backdrop-blur-xl shrink-0">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          {/* Organization Brand */}
          <div className="flex items-center select-none">
            <img src={`${BASE}logos/tph-name-logo.png`} alt="Three Points Hospitality" className="h-12 w-auto object-contain" />
          </div>

          <div className="hidden md:block h-6 w-px bg-border/60 mx-5" />

          {/* Software Brand */}
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide">
              <Zap className="h-3 w-3" />
              Autograde
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-accent/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span>Secure</span>
        </div>
      </div>
    </header>
  );
};