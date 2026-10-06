// Page layout: sidebar on the left, page on the right

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Fish, Menu } from "lucide-react";
import type { SidebarLayoutProps } from "./NavSidebar";

interface AppLayoutProps {
  // Draws the sidebar; the layout says whether it is collapsed and how to toggle it
  renderSidebar: (layout: SidebarLayoutProps) => ReactNode;
  currentPage: string;
  /** Background photo for this area (recoloured into the theme), e.g. "/assets/backdrop-admin.webp". */
  backdrop: string;
  children: ReactNode;
}

const COLLAPSED_KEY = "sidebar_collapsed";

/** Reads the saved sidebar state (storage can be blocked, so fall back to expanded). */
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

/** Sidebar plus page; on phones the sidebar becomes a slide-in menu. */
export function AppLayout({ renderSidebar, currentPage, backdrop, children }: AppLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPage]);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      // Not saved; the sidebar still toggles for this visit.
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block shrink-0">
        {renderSidebar({ isCollapsed, onToggle: toggleCollapsed })}
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/60 animate-in fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative h-full w-64 animate-in slide-in-from-left duration-200">
            {renderSidebar({ isCollapsed: false, onToggle: () => setIsMenuOpen(false) })}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(true)}
            className="rounded-md p-1.5 text-slate-300 hover:bg-white/10"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Fish className="w-5 h-5 text-cyan-300" />
          <span className="font-bold text-sm tracking-[0.08em] text-white">PHISHSIMULATOR</span>
        </div>

        <main
          className="app-backdrop flex-1 overflow-auto"
          style={{ "--backdrop-image": `url('${backdrop}')` } as CSSProperties}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
