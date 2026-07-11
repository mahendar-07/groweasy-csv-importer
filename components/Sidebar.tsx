"use client";

import {
  LayoutGrid,
  Zap,
  Users,
  MessageSquare,
  UserCircle2,
  Link2,
  Megaphone,
  Phone,
  ListChecks,
  Code2,
  Building2,
  X,
} from "lucide-react";

const MAIN_ITEMS = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Generate Leads", icon: Zap },
  { label: "Manage Leads", icon: Users, active: true },
  { label: "Engage Leads", icon: MessageSquare },
];

const CONTROL_ITEMS = [
  { label: "Team Members", icon: UserCircle2 },
  { label: "Lead Sources", icon: Link2 },
  { label: "Ad Accounts", icon: Megaphone },
  { label: "Tele Calling", icon: Phone },
  { label: "CRM Fields", icon: ListChecks },
  { label: "API Center", icon: Code2 },
];

interface SidebarProps {
  /** Whether the mobile drawer is open. Ignored on sm+ where the sidebar is always visible. */
  isOpen?: boolean;
  /** Called when the drawer should close (backdrop click, X button, or nav item tap). */
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Backdrop, mobile only, shown when drawer is open */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-5 transition-transform duration-200 ease-in-out sm:sticky sm:top-0 sm:z-0 sm:w-60 sm:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
              G
            </div>
            <span className="text-sm font-semibold text-slate-900">GrowEasy</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-50 sm:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-xs font-semibold text-blue-700">
          VK
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-800">VK Test</p>
          <p className="text-[10px] text-slate-400">Owner</p>
        </div>
      </div>

      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Main
      </p>
      <nav className="mb-5 flex flex-col gap-0.5">
        {MAIN_ITEMS.map(({ label, icon: Icon, active }) => (
          <div
            key={label}
            onClick={onClose}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${
              active
                ? "bg-emerald-50 font-medium text-emerald-700"
                : "text-slate-500"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </div>
        ))}
      </nav>

      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        Control Center
      </p>
      <nav className="flex flex-col gap-0.5">
        {CONTROL_ITEMS.map(({ label, icon: Icon }) => (
          <div
            key={label}
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-500"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            {label}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-500">
        <Building2 className="h-4 w-4" strokeWidth={1.75} />
        Business Center
      </div>
      </aside>
    </>
  );
}
