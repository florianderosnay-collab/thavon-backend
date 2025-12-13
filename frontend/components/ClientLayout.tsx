"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Pages that should NOT show sidebar
  const noSidebarPages = ["/login", "/reset-password", "/onboarding"];
  const shouldShowSidebar = !noSidebarPages.includes(pathname);

  return (
    <div className="flex min-h-screen">
      {/* Only show Sidebar if NOT on auth/onboarding pages */}
      {shouldShowSidebar && <Sidebar />}
      
      {/* Adjust margin: 0px for auth pages, 64px (16rem) for dashboard */}
      <main className={`flex-1 ${shouldShowSidebar ? "ml-64 p-8" : "ml-0"}`}>
        {children}
      </main>
    </div>
  );
}