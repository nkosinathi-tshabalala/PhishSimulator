// Admin navigation menu

import { BarChart3, ClipboardList, Database, FileText, Home, Send, User, Users } from "lucide-react";
import { NavSidebar, type NavItem, type SidebarLayoutProps } from "./NavSidebar";

interface AdminSidebarProps extends SidebarLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const ADMIN_ITEMS: NavItem[] = [
  { id: "admin-dashboard", label: "Dashboard", icon: Home, description: "Overview of platform activity", color: "text-sky-400" },
  { id: "datasets", label: "Datasets", icon: Database, description: "Upload and quality-check training data", color: "text-teal-400" },
  { id: "scenarios", label: "Scenario Review", icon: FileText, description: "Approve and activate scenarios", color: "text-violet-400" },
  { id: "baseline-management", label: "Baseline Questions", icon: ClipboardList, description: "Edit the player baseline quiz", color: "text-amber-400" },
  { id: "users", label: "Users", icon: Users, description: "View and moderate registered players", color: "text-pink-400" },
  { id: "analytics", label: "Analytics", icon: BarChart3, description: "Platform-wide performance insights", color: "text-green-400" },
  { id: "email-dispatcher", label: "Email Campaigns", icon: Send, description: "Send phishing tests to your own inboxes and track them", color: "text-slate-400" },
  { id: "admin-profile", label: "Admin Profile", icon: User, description: "Manage your administrator account", color: "text-slate-300" },
];

/** Navigation for the admin area. */
export function AdminSidebar(props: AdminSidebarProps) {
  return <NavSidebar subtitle="Security operations" items={ADMIN_ITEMS} {...props} />;
}
