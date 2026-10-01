// Sidebar shared by the player and admin menus

import { Fish, LogOut, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

// The layout passes these to every sidebar so the burger button can collapse it
export interface SidebarLayoutProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavSidebarProps extends SidebarLayoutProps {
  subtitle: string;
  items: NavItem[];
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  footer?: ReactNode;
  compactFooter?: ReactNode;
}

// Pages opened from Training keep the Training tab highlighted
const TRAINING_PAGES = ["email", "sms", "triage"];

/** Sidebar shared by the player and admin areas; collapses to icons only. */
export function NavSidebar({
  subtitle, items, currentPage, onNavigate, onLogout, footer, compactFooter, isCollapsed, onToggle,
}: NavSidebarProps) {
  return (
    <div
      className={`relative h-screen flex flex-col overflow-hidden bg-linear-to-b from-[#0a101c] via-[#080d17] to-[#0d0b1a] text-slate-300 border-r border-white/10 transition-[width] duration-200 ${
        isCollapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div className="pointer-events-none absolute -top-24 -left-16 w-64 h-64 rounded-full bg-sky-500/[0.06] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-20 w-64 h-64 rounded-full bg-violet-600/[0.06] blur-3xl" aria-hidden />

      <div className={`relative flex items-center gap-3 border-b border-white/10 py-4 ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
        <button
          type="button"
          onClick={onToggle}
          title={isCollapsed ? "Expand menu" : "Collapse menu"}
          aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
          className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-linear-to-br from-sky-400 to-indigo-500">
              <Fish className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-white text-sm leading-none tracking-[0.08em]">PHISHSIMULATOR</h2>
              <p className="text-xs mt-1 text-sky-400/80 truncate">{subtitle}</p>
            </div>
          </div>
        )}
      </div>

      <nav className="relative flex-1 p-3 pt-5 space-y-1 overflow-y-auto overflow-x-hidden">
        {items.map((item) => {
          const isActive = currentPage === item.id
            || (item.id === "simulations" && TRAINING_PAGES.includes(currentPage));
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={isCollapsed ? item.label : item.description}
              className={`w-full flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-all text-left ${
                isCollapsed ? "justify-center px-0" : "px-3"
              } ${
                isActive
                  ? "bg-linear-to-r from-sky-500/10 via-indigo-500/5 to-transparent text-white ring-1 ring-white/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-white/10" : "bg-white/[0.03]"}`}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
              </span>
              {!isCollapsed && item.label}
              {!isCollapsed && isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400/80" />}
            </button>
          );
        })}
      </nav>

      {isCollapsed
        ? compactFooter && <div className="relative flex justify-center pb-3">{compactFooter}</div>
        : footer && <div className="relative px-3 pb-3">{footer}</div>}

      <div className="relative p-3 border-t border-white/10">
        <button
          onClick={onLogout}
          title="Log out"
          className={`w-full flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-slate-400 transition-colors text-left hover:bg-red-400/10 hover:text-red-200 ${
            isCollapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <span className="w-8 h-8 rounded-md flex items-center justify-center bg-white/[0.03]">
            <LogOut className="w-4 h-4" />
          </span>
          {!isCollapsed && "Log out"}
        </button>
      </div>
    </div>
  );
}
