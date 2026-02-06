import React from 'react';
import { Layers, ShieldCheck, Zap } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          {/* Organization Brand */}
          <div className="flex flex-col justify-center leading-none select-none">
            <span className="font-display font-bold text-xl tracking-tight text-foreground uppercase">Three Points</span>
            <span className="font-display font-medium text-xs tracking-[0.2em] text-foreground/80 uppercase">Hospitality Group</span>
          </div>
          
          <div className="hidden md:block h-8 w-px bg-border mx-6"></div>
          
          {/* Software Brand - OpsFlow Integration */}
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider shadow-sm">
              <Zap className="h-3 w-3 fill-primary/20" />
              OpsFlow Autograde
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           {/* Mobile OpsFlow Badge (only visible on small screens) */}
           <div className="md:hidden">
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                <Zap className="h-4 w-4" />
              </span>
           </div>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Secure Environment</span>
          </div>
        </div>
      </div>
    </header>
  );
};