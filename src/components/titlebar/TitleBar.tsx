import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useHermozStore } from "@/store/useHermozStore";
import { Terminal, Minus, Square, X } from "lucide-react";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const { providerStatus, activeTab, setActiveTab } = useHermozStore();
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
      className="titlebar-root"
      data-purpose="window-titlebar"
      data-tauri-drag-region
      onMouseDown={handleDrag}
      onDoubleClick={handleDoubleClick}
      style={{
        height: 'var(--row-height)',
        background: 'var(--neutral-1)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-5)',
        zIndex: 30,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Left: Logo & Window Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }} data-tauri-drag-region>
        {/* Hermoz Avatar Mini */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--neutral-3)', border: '1px solid var(--color-border-strong)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-text-secondary)">
            <circle cx="12" cy="13" r="7" />
            <circle cx="7" cy="7" r="3" />
            <circle cx="17" cy="7" r="3" />
            <circle cx="10" cy="12" fill="var(--neutral-1)" r="1.5" />
            <circle cx="14" cy="12" fill="var(--neutral-1)" r="1.5" />
            <ellipse cx="12" cy="15" fill="var(--neutral-1)" rx="1.5" ry="1" />
          </svg>
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--color-success)',
            border: '2px solid var(--neutral-1)',
          }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }} data-tauri-drag-region>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)' }}>
            Hermoz
          </span>
          <span style={{
            fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)',
            padding: '1px 6px', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent-subtle)', color: 'var(--color-accent)',
            border: '1px solid var(--color-accent)',
            fontWeight: 'var(--weight-medium)', textTransform: 'uppercase',
          }}>
            v2.4
          </span>
        </div>
      </div>

      {/* Center: Workspace Entry Button & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <button
          style={{
            padding: '2px 10px', borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            transition: 'all 140ms',
            border: '1px solid',
            background: activeTab === "workspace" ? 'var(--color-accent-subtle)' : 'var(--neutral-3)',
            color: activeTab === "workspace" ? 'var(--color-accent)' : 'var(--color-text-secondary)',
            borderColor: activeTab === "workspace" ? 'var(--color-accent)' : 'var(--color-border)',
          }}
          onClick={() => setActiveTab("workspace")}
          title="Open Agent Workspace"
        >
          <Terminal size={13} />
          <span style={{ fontWeight: 'var(--weight-semibold)' }}>Workspace</span>
        </button>

        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: '2px 10px', borderRadius: 'var(--radius-full)',
            background: 'var(--neutral-2)', border: '1px solid var(--color-border)',
            fontSize: 'var(--text-2xs)', color: 'var(--color-text-muted)',
            pointerEvents: 'none',
          }}
          data-tauri-drag-region
        >
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: activeProvider ? 'var(--color-success)' : 'var(--color-text-muted)',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xs)' }}>
            {activeProvider ? `ONLINE \u2022 ${activeProvider.id.toUpperCase()}` : "LOCAL ENGINE"}
          </span>
        </div>
      </div>

      {/* Right: Window Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        <button
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)', background: 'transparent', border: 'none',
            transition: 'all 120ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--neutral-4)'; e.currentTarget.style.color = 'var(--color-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)', background: 'transparent', border: 'none',
            transition: 'all 120ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--neutral-4)'; e.currentTarget.style.color = 'var(--color-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          <Square size={12} />
        </button>
        <button
          style={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-muted)', background: 'transparent', border: 'none',
            transition: 'all 120ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = 'var(--color-danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
}
