import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMomoStore } from "@/store/useMomoStore";
import { ttsManager } from "@/core/tts/manager";
import { cleanTextForSpeech } from "@/core/tts/cleaner";
import {
  FolderOpen,
  Folder,
  FileText,
  Tag,
  AlertTriangle,
  ArrowUp,
  RotateCw,
  Plus,
  Terminal,
  Globe,
  FileCode,
  ListTodo,
} from "lucide-react";
import "./AgentWorkspace.css";

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

interface WebScrapeResult {
  url: string;
  title: string;
  content: string;
  status: number;
}

interface PendingCommandApproval {
  command: string;
  cwd?: string;
}

interface PendingFileApproval {
  path: string;
  newContent: string;
  originalContent: string;
}

interface PendingRenameApproval {
  oldPath: string;
  newPath: string;
}

interface PendingDeleteApproval {
  path: string;
}

export interface WorkspaceFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
}

interface WorkspaceLogItem {
  id: string;
  type: "command" | "file" | "research";
  title: string;
  status: "completed" | "failed" | "rejected";
  timestamp: string;
}

// Strict safe developer tools only - NO shells
const ALLOWED_CMDS = [
  "git",
  "npm",
  "npx",
  "pnpm",
  "cargo",
  "node",
  "python",
  "py",
  "pip",
  "dir",
  "echo",
  "cat",
  "ls",
  "grep",
  "find",
  "type",
  "tsc",
  "vite",
  "rustc",
];

export function AgentWorkspace() {
  const { settings, chooseWorkspaceFolder } = useMomoStore();
  const [activeSubTab, setActiveSubTab] = useState<"terminal" | "research" | "files" | "tasks">("terminal");

  // Terminal & Command State
  const [cmdInput, setCmdInput] = useState("");
  const [cmdCwd, setCmdCwd] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<Array<{ type: "cmd" | "out" | "err" | "info"; text: string }>>([
    { type: "info", text: "Momo Agent Workspace Subsystem initialized. Safe developer commands allowed." },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [pendingCmd, setPendingCmd] = useState<PendingCommandApproval | null>(null);

  // File Operations State
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [renameOldPath, setRenameOldPath] = useState("");
  const [renameNewPath, setRenameNewPath] = useState("");
  const [deletePath, setDeletePath] = useState("");
  const [pendingFile, setPendingFile] = useState<PendingFileApproval | null>(null);
  const [pendingRename, setPendingRename] = useState<PendingRenameApproval | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteApproval | null>(null);

  // Interactive File Explorer State
  const [fileList, setFileList] = useState<WorkspaceFileEntry[]>([]);
  const [currentSubpath, setCurrentSubpath] = useState<string>("");
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeFileName, setActiveFileName] = useState("");

  const loadWorkspaceFiles = async (subpath = "") => {
    if (!settings.workspaceFolder) {
      setFileList([]);
      return;
    }
    setIsLoadingFiles(true);
    try {
      const items = await invoke<WorkspaceFileEntry[]>("list_workspace_files", {
        workspace: settings.workspaceFolder,
        subpath: subpath || null,
      });
      setFileList(items);
      setCurrentSubpath(subpath);
    } catch (err) {
      console.warn("Failed to list files:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (settings.workspaceFolder) {
      loadWorkspaceFiles("");
    }
  }, [settings.workspaceFolder]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setActiveSubTab((prev) => (prev === "files" ? "terminal" : "files"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenFile = async (item: WorkspaceFileEntry) => {
    if (item.isDir) {
      loadWorkspaceFiles(item.path);
      return;
    }
    try {
      const content = await invoke<string>("read_workspace_file", {
        workspace: settings.workspaceFolder || null,
        path: item.path,
      });
      setFilePath(item.path);
      setActiveFileName(item.name);
      setFileContent(content);
      setIsEditorOpen(true);
    } catch (err) {
      console.warn("Failed to read file:", err);
      speakSummary(`Could not open ${item.name}: ${err}`);
    }
  };

  const handleNavigateUp = () => {
    if (!currentSubpath) return;
    const parts = currentSubpath.split("/").filter(Boolean);
    parts.pop();
    const parent = parts.join("/");
    loadWorkspaceFiles(parent);
  };

  // Web Research State
  const [researchUrl, setResearchUrl] = useState("https://en.wikipedia.org/wiki/Panda");
  const [isResearching, setIsResearching] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<WebScrapeResult | null>(null);

  // Tasks History
  const [taskHistory, setTaskHistory] = useState<WorkspaceLogItem[]>([
    {
      id: "init-1",
      type: "command",
      title: "Workspace initialized",
      status: "completed",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  // Real-time line-by-line terminal event streaming listener
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen<{ stream: "stdout" | "stderr"; text: string }>(
          "workspace-terminal-line",
          (event) => {
            setTerminalLogs((prev) => [
              ...prev,
              {
                type: event.payload.stream === "stdout" ? "out" : "err",
                text: event.payload.text,
              },
            ]);
          }
        ).then((fn) => {
          unlisten = fn;
        });
      })
      .catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const speakSummary = async (summary: string) => {
    try {
      const clean = cleanTextForSpeech(summary);
      if (clean) {
        await ttsManager.speak(clean);
      }
    } catch (e) {
      console.warn("TTS summary failed:", e);
    }
  };

  // Request Command Execution (triggers approval gate)
  const handleRequestRunCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = cmdInput.trim();
    if (!trimmed) return;
    setPendingCmd({
      command: trimmed,
      cwd: cmdCwd.trim() || undefined,
    });
  };

  // Approve & Run Command
  const handleApproveCommand = async () => {
    if (!pendingCmd) return;
    const { command, cwd } = pendingCmd;
    setPendingCmd(null);
    setIsRunning(true);

    setTerminalLogs((prev) => [
      ...prev,
      { type: "cmd", text: `$ ${command}${cwd ? ` (in ${cwd})` : ""}` },
    ]);

    try {
      const result = await invoke<CommandResult>("execute_workspace_command", {
        command,
        cwd,
        workspace: settings.workspaceFolder || null,
      });

      const isSuccess = result.exitCode === 0;
      setTerminalLogs((prev) => [
        ...prev,
        {
          type: isSuccess ? "info" : "err",
          text: `[Process exited with code ${result.exitCode} in ${result.durationMs}ms]`,
        },
      ]);

      const log: WorkspaceLogItem = {
        id: `cmd-${Date.now()}`,
        type: "command",
        title: command,
        status: isSuccess ? "completed" : "failed",
        timestamp: new Date().toLocaleTimeString(),
      };
      setTaskHistory((prev) => [log, ...prev]);

      const baseCmd = command.split(" ")[0];
      const audioSummary = isSuccess
        ? `Finished running ${baseCmd} in ${result.durationMs} milliseconds.`
        : `${baseCmd} failed with exit code ${result.exitCode}.`;
      speakSummary(audioSummary);
    } catch (err) {
      const errStr = String(err);
      setTerminalLogs((prev) => [
        ...prev,
        { type: "err", text: `Error: ${errStr}` },
      ]);
      setTaskHistory((prev) => [
        {
          id: `cmd-${Date.now()}`,
          type: "command",
          title: command,
          status: "failed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary(`Command execution blocked or failed: ${errStr}`);
    } finally {
      setIsRunning(false);
      setCmdInput("");
    }
  };

  const handleRejectCommand = () => {
    if (pendingCmd) {
      setTerminalLogs((prev) => [
        ...prev,
        { type: "err", text: `[Rejected command: ${pendingCmd.command}]` },
      ]);
      setTaskHistory((prev) => [
        {
          id: `cmd-${Date.now()}`,
          type: "command",
          title: pendingCmd.command,
          status: "rejected",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary("Command cancelled by user.");
    }
    setPendingCmd(null);
  };

  // Request File Modification (triggers approval gate)
  const handleRequestSaveFile = async () => {
    const trimmedPath = filePath.trim();
    if (!trimmedPath) return;

    let original = "";
    try {
      original = await invoke<string>("read_workspace_file", {
        path: trimmedPath,
        workspace: settings.workspaceFolder || null,
      });
    } catch {
      original = "(New file will be created)";
    }

    setPendingFile({
      path: trimmedPath,
      newContent: fileContent,
      originalContent: original,
    });
  };

  // Approve & Save File
  const handleApproveFile = async () => {
    if (!pendingFile) return;
    const { path, newContent } = pendingFile;
    setPendingFile(null);

    try {
      await invoke("write_workspace_file", {
        path,
        content: newContent,
        workspace: settings.workspaceFolder || null,
      });
      setTaskHistory((prev) => [
        {
          id: `file-${Date.now()}`,
          type: "file",
          title: `Write ${path}`,
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary(`Successfully updated ${path.split("/").pop() || "file"}.`);
    } catch (err) {
      setTaskHistory((prev) => [
        {
          id: `file-${Date.now()}`,
          type: "file",
          title: `Write ${path}`,
          status: "failed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary(`Failed to write file: ${err}`);
    }
  };

  const handleRejectFile = () => {
    if (pendingFile) {
      setTaskHistory((prev) => [
        {
          id: `file-${Date.now()}`,
          type: "file",
          title: `Write ${pendingFile.path}`,
          status: "rejected",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary("File edit rejected.");
    }
    setPendingFile(null);
  };

  // Rename File / Folder
  const handleApproveRename = async () => {
    if (!pendingRename) return;
    const { oldPath, newPath } = pendingRename;
    setPendingRename(null);

    try {
      await invoke("rename_workspace_file", {
        workspace: settings.workspaceFolder || "",
        oldPath,
        newPath,
      });
      setTaskHistory((prev) => [
        {
          id: `file-${Date.now()}`,
          type: "file",
          title: `Rename ${oldPath} -> ${newPath}`,
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary(`Renamed ${oldPath} to ${newPath}.`);
      setRenameOldPath("");
      setRenameNewPath("");
    } catch (err) {
      speakSummary(`Rename failed: ${err}`);
    }
  };

  // Delete File / Folder
  const handleApproveDelete = async () => {
    if (!pendingDelete) return;
    const { path } = pendingDelete;
    setPendingDelete(null);

    try {
      await invoke("delete_workspace_file", {
        workspace: settings.workspaceFolder || "",
        path,
      });
      setTaskHistory((prev) => [
        {
          id: `file-${Date.now()}`,
          type: "file",
          title: `Delete ${path}`,
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      speakSummary(`Deleted ${path}.`);
      setDeletePath("");
    } catch (err) {
      speakSummary(`Delete failed: ${err}`);
    }
  };

  // Autonomous Web Research via lightweight HTTP fetch (zero browser overhead)
  const handleFetchResearch = async () => {
    const url = researchUrl.trim();
    if (!url) return;
    setIsResearching(true);
    setScrapeResult(null);

    try {
      const result = await invoke<WebScrapeResult>("fetch_web_content", { url });
      setScrapeResult(result);
      setTaskHistory((prev) => [
        {
          id: `web-${Date.now()}`,
          type: "research",
          title: result.title || url,
          status: "completed",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      const shortTitle = result.title ? result.title.slice(0, 40) : "page";
      speakSummary(`Retrieved research content for ${shortTitle}.`);
    } catch (err) {
      setScrapeResult({
        url,
        title: "Fetch Failed",
        content: `Failed to fetch web content: ${err}`,
        status: 500,
      });
      speakSummary("Web research fetch failed.");
    } finally {
      setIsResearching(false);
    }
  };

  return (
    <div className="momo-workspace-container">
      {/* Workspace Header */}
      <div className="momo-workspace-header">
        <div className="momo-workspace-title">
          <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Agent Workspace</span>
          <span className="momo-workspace-badge">Dell OptiPlex Ready</span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono">
          Safe Mode Active
        </div>
      </div>

      {/* Granted Workspace Folder Scope Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--neutral-1)] border border-[var(--color-border)] rounded-lg text-[11px] mb-2">
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-gray-400 font-semibold">Scope:</span>
          <span className="font-mono text-gray-200 truncate" title={settings.workspaceFolder || "No folder granted"}>
            {settings.workspaceFolder || "Default (None Granted)"}
          </span>
        </div>
        <button
          type="button"
          className="px-2 py-0.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 rounded text-[10.5px] font-semibold shrink-0 transition-colors flex items-center gap-1"
          onClick={() => chooseWorkspaceFolder()}
        >
          <FolderOpen size={11} />
          <span>Choose Folder</span>
        </button>
      </div>

      {/* Sub Navigation */}
      <nav className="momo-workspace-subnav">
        <button
          className={`momo-workspace-nav-btn ${activeSubTab === "terminal" ? "active" : ""}`}
          onClick={() => setActiveSubTab("terminal")}
        >
          Terminal
        </button>
        <button
          className={`momo-workspace-nav-btn ${activeSubTab === "research" ? "active" : ""}`}
          onClick={() => setActiveSubTab("research")}
        >
          Web Research
        </button>
        <button
          className={`momo-workspace-nav-btn ${activeSubTab === "files" ? "active" : ""}`}
          onClick={() => setActiveSubTab("files")}
        >
          Files (Ctrl+B)
        </button>
        <button
          className={`momo-workspace-nav-btn ${activeSubTab === "tasks" ? "active" : ""}`}
          onClick={() => setActiveSubTab("tasks")}
        >
          Log ({taskHistory.length})
        </button>
      </nav>

      {/* Command Approval Modal / Card */}
      {pendingCmd && (
        <div className="momo-approval-card">
          <div className="momo-approval-header">
            <Terminal size={14} className="text-amber-400" />
            <span>Command Approval Required</span>
          </div>
          <div className="text-[11px] text-gray-400 mb-2">
            Momo wants to execute the following command on your local machine:
          </div>
          <div className="momo-approval-cmd">
            {pendingCmd.command}
            {pendingCmd.cwd && (
              <div className="text-[9.5px] text-gray-400 mt-1 font-sans">
                Working directory: {pendingCmd.cwd}
              </div>
            )}
          </div>
          <div className="momo-approval-actions">
            <button className="momo-reject-btn" onClick={handleRejectCommand}>
              Reject
            </button>
            <button className="momo-approve-btn" onClick={handleApproveCommand}>
              Approve &amp; Run
            </button>
          </div>
        </div>
      )}

      {/* File Approval Modal / Card */}
      {pendingFile && (
        <div className="momo-approval-card">
          <div className="momo-approval-header">
            <FileText size={14} className="text-amber-400" />
            <span>File Modification Approval</span>
          </div>
          <div className="text-[11px] text-gray-400 mb-2">
            Target: <strong className="text-gray-200 font-mono">{pendingFile.path}</strong>
          </div>
          <div className="momo-approval-diff">
            <div className="text-[10px] text-gray-500 mb-1">--- Proposed Content Preview ---</div>
            <pre className="momo-diff-add">{pendingFile.newContent.slice(0, 400)}</pre>
            {pendingFile.newContent.length > 400 && (
              <div className="text-[9px] text-gray-500">... ({pendingFile.newContent.length - 400} more chars)</div>
            )}
          </div>
          <div className="momo-approval-actions">
            <button className="momo-reject-btn" onClick={handleRejectFile}>
              Reject
            </button>
            <button className="momo-approve-btn" onClick={handleApproveFile}>
              Approve &amp; Write File
            </button>
          </div>
        </div>
      )}

      {/* Rename Approval Card */}
      {pendingRename && (
        <div className="momo-approval-card">
          <div className="momo-approval-header">
            <Tag size={14} className="text-purple-400" />
            <span>Rename Approval Required</span>
          </div>
          <div className="text-[11px] text-gray-400 mb-2 font-mono flex items-center gap-1.5">
            Rename: <span className="text-gray-300">{pendingRename.oldPath}</span> →{" "}
            <span style={{ color: "var(--color-accent)" }}>{pendingRename.newPath}</span>
          </div>
          <div className="momo-approval-actions">
            <button className="momo-reject-btn" onClick={() => setPendingRename(null)}>
              Cancel
            </button>
            <button className="momo-approve-btn" onClick={handleApproveRename}>
              Approve &amp; Rename
            </button>
          </div>
        </div>
      )}

      {/* Delete Approval Card */}
      {pendingDelete && (
        <div className="momo-approval-card" style={{ borderColor: "var(--color-danger)" }}>
          <div className="momo-approval-header" style={{ color: "var(--color-danger)" }}>
            <AlertTriangle size={14} />
            <span>Permanent Deletion Warning</span>
          </div>
          <div className="text-[11.5px] text-red-300 mb-2 font-mono">
            Are you sure you want to permanently delete: <strong>{pendingDelete.path}</strong>?
          </div>
          <div className="momo-approval-actions">
            <button className="momo-reject-btn" onClick={() => setPendingDelete(null)}>
              Cancel
            </button>
            <button
              className="momo-approve-btn"
              style={{ background: "#dc2626", color: "#fff" }}
              onClick={handleApproveDelete}
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: TERMINAL */}
      {activeSubTab === "terminal" && (
        <div className="space-y-2.5">
          {/* Allowlist Indicators */}
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 font-medium">Safe Allowlist (No Shells):</div>
            <div className="momo-allowlist-row">
              {ALLOWED_CMDS.map((cmd) => (
                <span key={cmd} className="momo-allowlist-pill">
                  {cmd}
                </span>
              ))}
            </div>
          </div>

          {/* Terminal Console Output */}
          <div className="momo-terminal-box">
            {terminalLogs.map((log, idx) => (
              <div
                key={idx}
                className={`momo-terminal-line ${
                  log.type === "cmd"
                    ? "momo-terminal-prompt"
                    : log.type === "err"
                    ? "momo-terminal-error"
                    : log.type === "info"
                    ? "text-[var(--color-accent)]"
                    : "text-gray-300"
                }`}
              >
                {log.text}
              </div>
            ))}
            {isRunning && (
              <div className="momo-terminal-line text-amber-400 animate-pulse">
                Running process...
              </div>
            )}
          </div>

          {/* Terminal Input Form */}
          <form onSubmit={handleRequestRunCommand} className="space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                className="flex-1 bg-[var(--neutral-1)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-mono placeholder-gray-600 outline-none"
                placeholder="e.g. git status, cargo check, npm test"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                disabled={isRunning}
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors"
                disabled={isRunning || !cmdInput.trim()}
              >
                Execute
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono shrink-0">cwd:</span>
              <input
                type="text"
                className="flex-1 bg-[var(--neutral-1)] border border-[var(--color-border)] rounded px-2 py-1 text-[10.5px] text-gray-400 font-mono placeholder-gray-700 outline-none"
                placeholder="Optional working directory (defaults to workspace)"
                value={cmdCwd}
                onChange={(e) => setCmdCwd(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: WEB RESEARCH */}
      {activeSubTab === "research" && (
        <div className="space-y-2.5">
          <div className="text-[11px] text-gray-400">
            Fetch external web documentation or articles directly without running a heavy Chromium browser instance.
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              className="flex-1 bg-[var(--neutral-1)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-mono placeholder-gray-600 outline-none"
              placeholder="https://..."
              value={researchUrl}
              onChange={(e) => setResearchUrl(e.target.value)}
              disabled={isResearching}
            />
            <button
              className="px-3 py-1.5 font-bold text-xs rounded-lg transition-colors"
              style={{
                background: "var(--color-accent)",
                color: "#ffffff",
                border: "1px solid var(--color-accent-hover)",
              }}
              onClick={handleFetchResearch}
              disabled={isResearching || !researchUrl.trim()}
            >
              {isResearching ? "Fetching..." : "Fetch"}
            </button>
          </div>

          {scrapeResult && (
            <div
              className="rounded-xl p-3 space-y-2"
              style={{
                background: "var(--neutral-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                className="flex items-center justify-between pb-1.5"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <span
                  className="text-xs font-bold truncate max-w-[200px]"
                  style={{ color: "var(--color-accent)" }}
                >
                  {scrapeResult.title || "Web Result"}
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  HTTP {scrapeResult.status}
                </span>
              </div>
              <div className="text-[11px] text-gray-300 font-sans max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {scrapeResult.content}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: FILE OPERATIONS & EXPLORER */}
      {activeSubTab === "files" && (
        <div className="space-y-3">
          {!settings.workspaceFolder ? (
            <div
              className="p-5 rounded-xl text-center space-y-2.5"
              style={{
                background: "var(--neutral-1)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex justify-center">
                <FolderOpen size={32} style={{ color: "var(--color-accent)" }} />
              </div>
              <div className="text-xs font-semibold text-gray-200">No Workspace Folder Granted</div>
              <div className="text-[11px] text-gray-400 max-w-[280px] mx-auto leading-relaxed">
                Choose a project directory to let Momo inspect files, edit code, and manage project assets safely.
              </div>
              <button
                type="button"
                className="px-3 py-1.5 font-semibold text-xs rounded-lg transition-all"
                style={{
                  background: "var(--color-accent)",
                  color: "#ffffff",
                  border: "1px solid var(--color-accent-hover)",
                }}
                onClick={() => chooseWorkspaceFolder().then(() => loadWorkspaceFiles(""))}
              >
                Choose Workspace Folder
              </button>
            </div>
          ) : (
            <>
              {/* Explorer Toolbar & Breadcrumbs */}
              <div
                className="rounded-xl p-2 space-y-2"
                style={{
                  background: "var(--neutral-1)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0 font-mono text-gray-300">
                    <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>root</span>
                    {currentSubpath && (
                      <span className="truncate text-gray-400">
                        / {currentSubpath}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentSubpath && (
                      <button
                        className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors"
                        style={{
                          background: "var(--neutral-3)",
                          border: "1px solid var(--color-border)",
                          color: "var(--color-text)",
                        }}
                        onClick={handleNavigateUp}
                        title="Go up one folder"
                      >
                        <ArrowUp size={10} />
                        <span>Up</span>
                      </button>
                    )}
                    <button
                      className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition-colors"
                      style={{
                        background: "var(--neutral-3)",
                        border: "1px solid var(--color-border)",
                        color: "var(--color-text)",
                      }}
                      onClick={() => loadWorkspaceFiles(currentSubpath)}
                      title="Refresh file tree"
                    >
                      <RotateCw size={10} />
                      <span>Refresh</span>
                    </button>
                    <button
                      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 transition-colors"
                      style={{
                        background: "var(--color-accent-subtle)",
                        border: "1px solid var(--color-accent)",
                        color: "var(--color-accent)",
                      }}
                      onClick={() => {
                        const newPath = currentSubpath ? `${currentSubpath}/new-file.txt` : "new-file.txt";
                        setFilePath(newPath);
                        setActiveFileName("new-file.txt");
                        setFileContent("");
                        setIsEditorOpen(true);
                      }}
                      title="Create new file in current folder"
                    >
                      <Plus size={10} />
                      <span>New File</span>
                    </button>
                  </div>
                </div>

                {/* File Tree List */}
                <div
                  className="max-h-48 overflow-y-auto rounded-lg divide-y text-xs font-mono"
                  style={{
                    border: "1px solid var(--color-border)",
                  }}
                >
                  {isLoadingFiles ? (
                    <div className="p-3 text-center text-gray-500 animate-pulse text-[11px]">
                      Loading files...
                    </div>
                  ) : fileList.length === 0 ? (
                    <div className="p-3 text-center text-gray-500 text-[11px]">
                      (Empty folder)
                    </div>
                  ) : (
                    fileList.map((entry) => (
                      <div
                        key={entry.path}
                        className="px-2.5 py-1.5 flex items-center justify-between hover:bg-neutral-800/40 cursor-pointer transition-colors group"
                        style={{
                          background: filePath === entry.path ? "var(--color-accent-subtle)" : "transparent",
                          borderLeft: filePath === entry.path ? "2px solid var(--color-accent)" : "none",
                        }}
                        onClick={() => handleOpenFile(entry)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {entry.isDir ? (
                            <Folder size={13} style={{ color: "var(--color-accent)" }} />
                          ) : (
                            <FileText size={13} style={{ color: "var(--color-text-muted)" }} />
                          )}
                          <span
                            className="truncate"
                            style={{
                              color: entry.isDir ? "var(--color-accent)" : "var(--color-text)",
                              fontWeight: entry.isDir ? "var(--weight-semibold)" : "normal",
                            }}
                          >
                            {entry.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!entry.isDir && (
                            <span className="text-[10px] text-gray-500">
                              {entry.size < 1024
                                ? `${entry.size} B`
                                : `${(entry.size / 1024).toFixed(1)} KB`}
                            </span>
                          )}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              className="px-1 py-0.5 rounded bg-[var(--neutral-4)] hover:bg-[var(--neutral-4)] text-sky-400 text-[9px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameOldPath(entry.path);
                                setRenameNewPath(entry.path);
                              }}
                              title="Rename"
                            >
                              Rename
                            </button>
                            <button
                              className="px-1 py-0.5 rounded bg-[var(--neutral-4)] hover:bg-red-950 text-red-400 text-[9px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletePath(entry.path);
                                setPendingDelete({ path: entry.path });
                              }}
                              title="Delete"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* File Editor & Preview Drawer */}
              {isEditorOpen && (
                <div className="bg-[var(--neutral-1)] border border-[var(--color-border)] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-[var(--color-accent)] font-mono truncate">
                        {activeFileName || filePath}
                      </span>
                    </div>
                    <button
                      className="text-gray-500 hover:text-gray-300 text-xs font-mono"
                      onClick={() => setIsEditorOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-mono">Relative Path:</label>
                    <input
                      type="text"
                      className="w-full bg-[var(--neutral-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-lg px-2.5 py-1 text-xs text-gray-200 font-mono outline-none"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 font-mono">File Contents:</label>
                    <textarea
                      className="w-full h-32 bg-[var(--neutral-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-lg p-2 text-xs text-gray-200 font-mono outline-none resize-none leading-relaxed"
                      placeholder="Write code or text..."
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                    />
                  </div>
                  <button
                    className="w-full py-1.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors"
                    onClick={handleRequestSaveFile}
                    disabled={!filePath.trim()}
                  >
                    Save / Propose Write (Gated)
                  </button>
                </div>
              )}

              {/* Quick File Operations Collapsible: Rename / Delete */}
              <div className="border border-[var(--color-border)] rounded-xl p-2.5 space-y-2.5 bg-[var(--neutral-1)]">
                <div className="text-[10.5px] font-semibold text-gray-400">File Utilities</div>
                {/* Rename */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 bg-[var(--neutral-2)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-gray-200 font-mono placeholder-gray-600 outline-none"
                    placeholder="Old relative path"
                    value={renameOldPath}
                    onChange={(e) => setRenameOldPath(e.target.value)}
                  />
                  <input
                    type="text"
                    className="flex-1 bg-[var(--neutral-2)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-gray-200 font-mono placeholder-gray-600 outline-none"
                    placeholder="New relative path"
                    value={renameNewPath}
                    onChange={(e) => setRenameNewPath(e.target.value)}
                  />
                  <button
                    className="px-2.5 py-1 bg-sky-600/30 hover:bg-sky-600/40 text-sky-300 font-bold text-xs rounded-lg border border-sky-500/30 transition-colors disabled:opacity-50"
                    onClick={() => setPendingRename({ oldPath: renameOldPath.trim(), newPath: renameNewPath.trim() })}
                    disabled={!renameOldPath.trim() || !renameNewPath.trim()}
                  >
                    Rename
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: TASK HISTORY */}
      {activeSubTab === "tasks" && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {taskHistory.map((item) => (
            <div
              key={item.id}
              className="p-2 rounded-lg bg-[var(--neutral-1)] border border-[var(--color-border)] text-[11px] flex items-center justify-between"
            >
              <div className="flex items-center space-x-2 truncate">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.status === "completed"
                      ? "var(--color-accent)"
                      : item.status === "rejected"
                      ? "bg-amber-400"
                      : "bg-red-400"
                  }`}
                />
                <span className="text-gray-300 truncate">{item.title}</span>
              </div>
              <span className="text-[9.5px] text-gray-500 font-mono shrink-0 ml-2">
                {item.timestamp}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AgentWorkspace;
