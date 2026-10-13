// Sidebar shared by the player and admin menus

import { Fish, LogOut, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
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

/** Sidebar shared by the player and admin areas; collapses to icons only.
 * Same navy as the pages; the open page is marked with the cyan accent (bar, icon and tint). */
export function NavSidebar({
  subtitle, items, currentPage, onNavigate, onLogout, footer, compactFooter, isCollapsed, onToggle,
}: NavSidebarProps) {
  return (
    <div
      className={`relative h-screen flex flex-col overflow-hidden bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 ${
        isCollapsed ? "w-[76px]" : "w-64"
      }`}
    >
      <div className="pointer-events-none absolute -top-28 -left-20 w-72 h-72 rounded-full bg-cyan-400/[0.07] blur-3xl" aria-hidden />

      <div className={`relative flex items-center gap-3 border-b border-sidebar-border py-4 ${isCollapsed ? "justify-center px-2" : "px-4"}`}>
        <button
          type="button"
          onClick={onToggle}
          title={isCollapsed ? "Expand menu" : "Collapse menu"}
          aria-label={isCollapsed ? "Expand menu" : "Collapse menu"}
          className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-sidebar-accent hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        {!isCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-linear-to-br from-cyan-300 to-sky-600 shadow-[0_0_18px_rgba(34,211,238,0.35)]">
              <Fish className="w-4 h-4 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-white text-sm leading-none tracking-[0.08em]">PHISHSIMULATOR</h2>
              <p className="text-xs mt-1 text-cyan-300/70 truncate">{subtitle}</p>
            </div>
          </div>
        )}
      </div>

      <nav className="relative flex-1 p-3 pt-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Menu</p>
        )}
        {items.map((item) => {
          const isActive = currentPage === item.id
            || (item.id === "simulations" && TRAINING_PAGES.includes(currentPage));
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={isCollapsed ? item.label : item.description}
              aria-current={isActive ? "page" : undefined}
              className={`group relative w-full flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors text-left ${
                isCollapsed ? "justify-center px-0" : "px-3"
              } ${
                isActive
                  ? "bg-cyan-400/10 text-white"
                  : "text-slate-400 hover:bg-sidebar-accent hover:text-slate-100"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" aria-hidden />
              )}
              <item.icon
                className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                  isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"
                }`}
              />
              {!isCollapsed && item.label}
            </button>
          );
        })}
      </nav>

      {isCollapsed
        ? compactFooter && <div className="relative flex justify-center pb-3">{compactFooter}</div>
        : footer && <div className="relative px-3 pb-3">{footer}</div>}

      <div className="relative p-3 border-t border-sidebar-border">
        <button
          onClick={onLogout}
          title="Log out"
          className={`group w-full flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium text-slate-400 transition-colors text-left hover:bg-red-400/10 hover:text-red-200 ${
            isCollapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <LogOut className="w-[18px] h-[18px] text-slate-500 group-hover:text-red-300" />
          {!isCollapsed && "Log out"}
        </button>
      </div>
    </div>
  );
}
