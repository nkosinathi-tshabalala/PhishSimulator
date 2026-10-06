// Admin navigation menu

import { BarChart3, ClipboardList, Database, FileText, Home, Send, User, Users } from "lucide-react";
import { NavSidebar, type NavItem, type SidebarLayoutProps } from "./NavSidebar";

interface AdminSidebarProps extends SidebarLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

const ADMIN_ITEMS: NavItem[] = [
  { id: "admin-dashboard", label: "Dashboard", icon: Home, description: "Overview of platform activity" },
  { id: "datasets", label: "Datasets", icon: Database, description: "Upload and quality-check training data" },
  { id: "scenarios", label: "Scenario Review", icon: FileText, description: "Approve and activate scenarios" },
  { id: "baseline-management", label: "Baseline Questions", icon: ClipboardList, description: "Edit the player baseline quiz" },
  { id: "users", label: "Users", icon: Users, description: "View and moderate registered players" },
  { id: "analytics", label: "Analytics", icon: BarChart3, description: "Platform-wide performance insights" },
  { id: "email-dispatcher", label: "Email Campaigns", icon: Send, description: "Send phishing tests to your own inboxes and track them" },
  { id: "admin-profile", label: "Admin Profile", icon: User, description: "Manage your administrator account" },
];

/** Navigation for the admin area. */
export function AdminSidebar(props: AdminSidebarProps) {
  return <NavSidebar subtitle="Security operations" items={ADMIN_ITEMS} {...props} />;
}
