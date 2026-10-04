"use client";

import { useState } from "react";
import Sidebar from "@/shared/components/Sidebar";
import Header from "@/shared/components/Header";
import { ToastProvider } from "@/shared/components/Toast";

export default function DashboardLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-bg text-text-main">
        {/* sidebar desktop */}
        <div className="hidden lg:flex">
          <Sidebar />
        </div>

        {/* sidebar mobile */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden fade-in"
            onClick={() => setOpen(false)}
          />
        )}
        <div
          className={`fixed lg:static inset-y-0 left-0 z-50 transition-transform duration-200 lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="lg:hidden h-full">
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </div>

        {/* main */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <Header onMenu={() => setOpen((v) => !v)} />
          <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-4 custom-scrollbar">
            <div className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
