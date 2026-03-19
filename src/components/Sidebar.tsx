import React from 'react';
import { Users, ClipboardCheck, Settings, Zap, ChevronRight, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

export type AppPage = 'staff' | 'assign' | 'grade' | 'admin';

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ReactNode;
  section: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'staff',
    label: 'Manage Staff',
    icon: <Users className="w-4 h-4" />,
    section: 'Staff',
  },
  {
    id: 'assign',
    label: 'Test Assigner',
    icon: <BookOpenCheck className="w-4 h-4" />,
    section: 'Staff',
  },
  {
    id: 'grade',
    label: 'Grade Exam',
    icon: <ClipboardCheck className="w-4 h-4" />,
    section: 'Grading',
  },
];

const BASE = import.meta.env.BASE_URL || '/';

interface SidebarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  // Group nav items by section
  const sections = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  return (
    <aside className="w-60 shrink-0 border-r border-border/60 bg-card/60 flex flex-col h-full overflow-hidden">

      {/* Logo / Brand */}
      <div className="p-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <img
            src={`${BASE}logos/tph-name-logo.png`}
            alt="Three Points Hospitality"
            className="h-10 w-auto object-contain"
          />
        </div>
        <div className="mt-2.5">
          <span className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide">
            <Zap className="h-2.5 w-2.5" />
            Autograde Dashboard
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 mb-1.5">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map(item => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <span className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                    )}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 space-y-1.5">
        {/* Admin nav item — pinned to bottom */}
        <button
          onClick={() => onNavigate('admin')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
            currentPage === 'admin'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <span className={cn(
            'shrink-0 transition-colors',
            currentPage === 'admin' ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )}>
            <ShieldCheck className="w-4 h-4" />
          </span>
          <span className="flex-1 text-left">Admin</span>
          {currentPage === 'admin' && (
            <ChevronRight className="w-3.5 h-3.5 text-primary/50 shrink-0" />
          )}
        </button>

        {/* AI status */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-medium text-emerald-700">AI Engine Online</span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 px-2">
          © {new Date().getFullYear()} Three Points Hospitality
        </p>
      </div>
    </aside>
  );
};
