import React from 'react';
import { ShieldCheck, Zap, ClipboardCheck, Users } from 'lucide-react';

const BASE = import.meta.env.BASE_URL || '/';

interface HeaderProps {
  currentPage?: 'grader' | 'assigner';
  onNavigate?: (page: 'grader' | 'assigner') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage = 'grader', onNavigate }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-white/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-18 items-center justify-between px-4">
        <div className="flex items-center">
          {/* Organization Brand */}
          <div className="flex items-center select-none cursor-pointer" onClick={() => onNavigate?.('grader')}>
            <img src={`${BASE}logos/tph-name-logo.png`} alt="Three Points Hospitality" className="h-14 w-auto object-contain" />
          </div>
          
          <div className="hidden md:block h-6 w-px bg-border/60 mx-5"></div>
          
          {/* Software Brand */}
          <div className="hidden md:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide">
              <Zap className="h-3 w-3" />
              Autograde
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => onNavigate?.('grader')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'grader'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
            Exam Grader
          </button>
          <button
            onClick={() => onNavigate?.('assigner')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === 'assigner'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            Test Assigner
          </button>
        </nav>
        
        <div className="flex items-center gap-3">
           {/* Mobile Nav */}
           <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => onNavigate?.('grader')}
                className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
                  currentPage === 'grader' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
              </button>
              <button
                onClick={() => onNavigate?.('assigner')}
                className={`flex items-center justify-center h-8 w-8 rounded-full transition-colors ${
                  currentPage === 'assigner' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                }`}
              >
                <Users className="h-4 w-4" />
              </button>
           </div>

          <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/60 bg-accent/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            <span>Secure</span>
          </div>
        </div>
      </div>
    </header>
  );
};