"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; 
import { LayoutDashboard, Users, Settings, LogOut, Briefcase } from "lucide-react"; // Import Briefcase

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Leads", href: "/leads" },
  { icon: Briefcase, label: "Team", href: "/team" }, // NEW TAB
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    // 1. Tell Supabase to kill the session
    await supabase.auth.signOut();
    
    // 2. Force redirect to login
    router.push("/login");
    router.refresh(); // Clear any cached data
  };

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col fixed left-0 top-0">
      {/* LOGO AREA */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white">T</div>
          THAVON
        </div>
      </div>

      {/* MENU ITEMS */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-violet-600" : "text-slate-400"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg w-full transition-colors text-left"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
}