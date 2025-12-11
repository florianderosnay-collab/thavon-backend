"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <div className="flex min-h-screen">
      {/* Only show Sidebar if NOT on login page */}
      {!isLoginPage && <Sidebar />}
      
      {/* Adjust margin: 0px for login page, 64px (16rem) for dashboard */}
      <main className={`flex-1 p-8 ${isLoginPage ? "ml-0" : "ml-64"}`}>
        {children}
      </main>
    </div>
  );
}