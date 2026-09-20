import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMomoStore } from "@/store/useMomoStore";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const { providerStatus, activeTab, setActiveTab } = useMomoStore();
  const activeProvider = providerStatus.find((p) => p.state === "connected");

  const handleMinimize = async () => {
    try {
      await invoke("minimize_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
      } catch {
        /* outside Tauri */
      }
    }
  };

  const handleMaximize = async () => {
    try {
      const nowMaximized = await invoke<boolean>("toggle_maximize_window");
      setIsMaximized(nowMaximized);
    } catch {
      try {
        const appWindow = getCurrentWindow();
        const maximized = await appWindow.isMaximized();
        if (maximized) {
          await appWindow.unmaximize();
          setIsMaximized(false);
        } else {
          await appWindow.maximize();
          setIsMaximized(true);
        }
      } catch {
        /* outside Tauri */
      }
    }
  };

  const handleClose = async () => {
    try {
      await invoke("close_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.close();
      } catch {
        /* outside Tauri */
      }
    }
  };

  const handleDrag = async (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.startDragging();
      } catch {
        /* outside Tauri */
      }
    }
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("button")) {
      await handleMaximize();
    }
  };

  return (
    <header
      className="h-10 bg-obsidian-950/90 border-b border-obsidian-800 flex items-center justify-between px-3.5 z-30 select-none shrink-0"
      data-purpose="window-titlebar"
      data-tauri-drag-region
      onMouseDown={handleDrag}
      onDoubleClick={handleDoubleClick}
    >
      {/* Left: Logo & Window Identity */}
      <div className="flex items-center space-x-3" data-tauri-drag-region>
        {/* Momo Avatar Mini Icon */}
        <div className="w-6 h-6 rounded-full bg-obsidian-800 border border-emerald-500/40 flex items-center justify-center relative shadow-glow-sm">
          <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="13" r="7"></circle>
            <circle cx="7" cy="7" r="3"></circle>
            <circle cx="17" cy="7" r="3"></circle>
            <circle cx="10" cy="12" fill="#0B100E" r="1.5"></circle>
            <circle cx="14" cy="12" fill="#0B100E" r="1.5"></circle>
            <ellipse cx="12" cy="15" fill="#0B100E" rx="1.5" ry="1"></ellipse>
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-obsidian-950 animate-pulse"></span>
        </div>
        <div className="flex items-center space-x-2" data-tauri-drag-region>
          <span className="text-xs font-semibold tracking-wide text-gray-200">Momo</span>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 font-medium">
            v2.4 Pro
          </span>
          <span className="text-xs text-gray-500 hidden sm:inline">• Desktop Companion (Active)</span>
        </div>
      </div>

      {/* Center: Workspace Entry Button & Status */}
      <div className="flex items-center space-x-2.5">
        <button
          className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-colors border ${
            activeTab === "workspace"
              ? "bg-emerald-950 text-emerald-300 border-emerald-500/40 shadow-sm"
              : "bg-obsidian-850 hover:bg-obsidian-800 text-gray-300 hover:text-white border-obsidian-750"
          }`}
          onClick={() => setActiveTab("workspace")}
          title="Open Agent Workspace"
        >
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-semibold">Workspace</span>
        </button>

        <div
          className="hidden md:flex items-center space-x-2 px-3 py-0.5 rounded-full bg-obsidian-900 border border-obsidian-750 text-[11px] text-gray-400 pointer-events-none"
          data-tauri-drag-region
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="font-mono text-emerald-400/90 text-[10px]">
            {activeProvider ? `ONLINE • ${activeProvider.id.toUpperCase()}` : "LOCAL ENGINE ACTIVE"}
          </span>
        </div>
      </div>

      {/* Right: Window Controls (Minimize, Maximize, Close) */}
      <div className="flex items-center space-x-1.5">
        <button
          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-obsidian-800 transition-colors"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
            <line x1="2" x2="10" y1="6" y2="6"></line>
          </svg>
        </button>
        <button
          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-obsidian-800 transition-colors"
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
            <rect height="8" rx="1" width="8" x="2" y="2"></rect>
          </svg>
        </button>
        <button
          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 12 12">
            <line x1="2.5" x2="9.5" y1="2.5" y2="9.5"></line>
            <line x1="9.5" x2="2.5" y1="2.5" y2="9.5"></line>
          </svg>
        </button>
      </div>
    </header>
  );
}
