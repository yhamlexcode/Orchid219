"use client";

import { useState } from "react";

type SidebarProps = {
  activeId: string;
  onSelect: (id: string) => void;
};

const MENU_ITEMS = [
  {
    id: "gemma", label: "Gemma", icon: (
      // Google 4-color G style icon
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    )
  },
  {
    id: "deepqwen", label: "DeepQwen", icon: (
      // DeepSeek whale/fish style icon
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.5 12c0 4.5-3.5 8-8.5 8-3.5 0-6.5-2-8-5 0 0 1.5 1 3.5 1 3 0 5-2.5 5-5s-2-4.5-5-4.5c-1.5 0-2.5.5-3 1C6 5 8.5 4 12 4c5 0 8.5 3.5 8.5 8z" />
        <circle cx="8" cy="10" r="1.5" />
        <path d="M4 8c-1-1-2-1-2-1s.5 1 1 2c.5 1 1 1.5 1 1.5S3.5 9.5 4 8z" />
      </svg>
    )
  },
  {
    id: "llama", label: "LLAMA 3.3", icon: (
      // Meta Llama style icon
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.5 1 3.5-.5.5-1 1.5-1 2.5 0 1.5 1 3 2.5 3.5 0 1 .5 2 1.5 3 1 1 2.5 1.5 4 1.5s3-.5 4-1.5c1-1 1.5-2 1.5-3 1.5-.5 2.5-2 2.5-3.5 0-1-.5-2-1-2.5.5-1 1-2 1-3.5 0-2.5-2.5-5-6-5z" />
        <circle cx="9.5" cy="8" r="1" />
        <circle cx="14.5" cy="8" r="1" />
        <path d="M9 12c0 0 1.5 2 3 2s3-2 3-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "history", label: "History", icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
    )
  },
  {
    id: "settings", label: "Settings", icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
    )
  },
];

export default function Sidebar({ activeId, onSelect }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`
        h-full bg-white/40 backdrop-blur-xl border-r border-white/20 shadow-xl 
        transition-all duration-300 ease-in-out flex flex-col
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Sidebar Header / Toggle */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 h-16">
        {!isCollapsed && (
          <span className="font-bold text-lg bg-gradient-to-r from-orange-400 to-rose-400 text-transparent bg-clip-text whitespace-nowrap overflow-hidden">
            Orchid219
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-white/50 text-stone-600 hover:text-orange-500 transition-colors mx-auto"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
          )}
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`
              w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200
              ${activeId === item.id
                ? "bg-white/80 shadow-md text-orange-500 ring-1 ring-orange-100"
                : "text-stone-600 hover:bg-white/40 hover:text-stone-900"}
              ${isCollapsed ? "justify-center" : "justify-start"}
            `}
            title={isCollapsed ? item.label : ""}
          >
            <span className="shrink-0">{item.icon}</span>
            {!isCollapsed && (
              <span className="font-medium whitespace-nowrap overflow-hidden text-sm">
                {item.label}
              </span>
            )}
            {activeId === item.id && !isCollapsed && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)]"></div>
            )}
          </button>
        ))}
      </nav>

      {/* Footer / User Profile Stub */}
      <div className="p-4 border-t border-white/10">
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-300 to-rose-300 shrink-0 shadow-inner"></div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-stone-700 truncate">User</p>
              <p className="text-xs text-stone-500 truncate">Free Plan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
