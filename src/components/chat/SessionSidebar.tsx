import React from "react";
import { useHermozStore } from "@/store/useHermozStore";
import {
  Plus,
  Folder,
  FolderOpen,
  MessageSquare,
  Trash2,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export function SessionSidebar() {
  const {
    sessions,
    activeSessionId,
    createNewSession,
    loadSession,
    deleteSession,
    settings,
    chooseWorkspaceFolder,
  } = useHermozStore();

  const folderName = settings.workspaceFolder
    ? settings.workspaceFolder.split(/[\\/]/).filter(Boolean).pop() || settings.workspaceFolder
    : null;

  return (
    <aside
      className="w-56 h-full flex flex-col shrink-0 select-none overflow-hidden"
      style={{
        background: "var(--neutral-2)",
        borderRight: "1px solid var(--color-border)",
      }}
      data-purpose="session-and-project-sidebar"
    >
      {/* Top Header & Actions */}
      <div className="p-3 border-b border-[var(--color-border)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Sparkles size={14} style={{ color: "var(--color-accent)" }} />
            <span className="text-xs font-bold tracking-wide" style={{ color: "var(--color-text)" }}>
              Hermoz Studio
            </span>
          </div>
        </div>

        {/* New Session Button */}
        <button
          onClick={createNewSession}
          className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-98"
          style={{
            background: "var(--gradient-antigravity)",
            color: "var(--color-accent-text)",
            boxShadow: "var(--glow-accent-sm)",
          }}
          title="Start a fresh conversation and project session"
        >
          <Plus size={14} />
          <span>New Session</span>
        </button>

        {/* Workspace Folder Selector Widget */}
        <div
          className="p-2 rounded-lg flex flex-col gap-1 transition-all cursor-pointer hover:border-[var(--color-accent)]"
          style={{
            background: "var(--neutral-1)",
            border: "1px solid var(--color-border)",
          }}
          onClick={() => chooseWorkspaceFolder()}
          title="Click to select or change working project folder"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 flex items-center gap-1">
              <Folder size={11} style={{ color: "var(--color-accent)" }} />
              Workspace
            </span>
            <span
              className="text-[10px] font-mono hover:underline"
              style={{ color: "var(--color-accent)" }}
            >
              Change
            </span>
          </div>
          <div
            className="text-xs font-medium truncate flex items-center space-x-1"
            style={{ color: folderName ? "var(--color-text)" : "var(--color-text-muted)" }}
          >
            <FolderOpen size={12} className="shrink-0 text-amber-400" />
            <span className="truncate">{folderName || "Select Folder..."}</span>
          </div>
          {settings.workspaceFolder && (
            <span className="text-[9.5px] font-mono text-gray-500 truncate" title={settings.workspaceFolder}>
              {settings.workspaceFolder}
            </span>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        <div className="px-2 py-1 flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={11} /> Sessions ({sessions.length})
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="p-3 text-center text-xs text-gray-500 italic">
            No previous sessions yet. Start chatting to create one!
          </div>
        ) : (
          sessions.map((sess) => {
            const isActive = sess.id === activeSessionId;
            const timeStr = new Date(sess.updatedAt || sess.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={sess.id}
                onClick={() => loadSession(sess.id)}
                className="group relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-all"
                style={{
                  background: isActive ? "var(--color-accent-subtle)" : "transparent",
                  color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                  border: isActive
                    ? "1px solid var(--color-accent)"
                    : "1px solid transparent",
                }}
                title={sess.title}
              >
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <MessageSquare
                    size={13}
                    className="shrink-0"
                    style={{ color: isActive ? "var(--color-accent)" : "var(--color-text-muted)" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{sess.title || "Untitled Session"}</p>
                    <span className="text-[10px] text-gray-500">{timeStr}</span>
                  </div>
                </div>

                {/* Delete button on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(sess.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all ml-1 shrink-0 bg-transparent border-0 cursor-pointer"
                  title="Delete session"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-[var(--color-border)] text-center text-[10px] font-mono text-gray-500">
        Hermoz v0.1.0 • Antigravity
      </div>
    </aside>
  );
}
