import React, { useEffect, useState } from "react";
import { useMomoStore } from "@/store/useMomoStore";
import {
  Terminal, FileSearch, FileEdit, Tag, AlertTriangle,
  Globe, Rocket, Lightbulb, File, Sparkles, Trash2,
  Link, Square, FolderOpen, Camera
} from "lucide-react";
import "./ActionApprovalModal.css";

interface ActionApprovalModalProps {
  isOverlayMode: boolean;
}

export function ActionApprovalModal({ isOverlayMode }: ActionApprovalModalProps) {
  const {
    pendingAction,
    agentCheckpoint,
    settings,
    approvePendingAction,
    denyPendingAction,
    stopAgentLoop,
    chooseWorkspaceFolder,
    capturePromptOpen,
    resolveCaptureConfirmation,
  } = useMomoStore();

  const [isProcessing, setIsProcessing] = useState(false);

  const isExecuting = agentCheckpoint?.status === "executing";
  const isVisible = Boolean(pendingAction) || isExecuting;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (capturePromptOpen) {
        if (e.key === "Enter") {
          e.preventDefault();
          resolveCaptureConfirmation(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          resolveCaptureConfirmation(null);
        }
        return;
      }
      if (!isVisible || isProcessing || isExecuting) return;
      if (e.key === "Enter" && pendingAction) {
        e.preventDefault();
        handleApprove();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleDeny();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, pendingAction, isProcessing, isExecuting, capturePromptOpen, resolveCaptureConfirmation]);

  if (capturePromptOpen) {
    return (
      <div className={`action-modal-backdrop ${isOverlayMode ? "mode-overlay" : "mode-dashboard"}`}>
        <div className="action-modal-card">
          <div className="action-modal-header">
            <div className="badge-row">
              <span className="action-badge badge-file"><Camera size={12} /> SCREEN INSPECT</span>
            </div>
            <button
              type="button"
              className="stop-agent-btn"
              onClick={() => resolveCaptureConfirmation(null)}
              title="Cancel inspection"
            >
              Cancel
            </button>
          </div>
          <div className="action-modal-body">
            <p className="action-question">I'll show up in my own screenshot. Hide me first?</p>
            <p className="action-reason">
              Screen capture exclusion is currently turned OFF in Settings.
            </p>
          </div>
          <div className="action-modal-footer">
            <button
              type="button"
              className="btn-action btn-deny"
              onClick={() => resolveCaptureConfirmation(false)}
            >
              Capture anyway
            </button>
            <button
              type="button"
              className="btn-action btn-allow"
              onClick={() => resolveCaptureConfirmation(true)}
            >
              Hide and capture
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isVisible && !isExecuting) return null;

  const handleApprove = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await approvePendingAction();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = () => {
    denyPendingAction();
  };

  const action = pendingAction;
  const actionType = action?.type || "command";

  const renderBadge = () => {
    switch (actionType) {
      case "command":
        return <span className="action-badge badge-cmd"><Terminal size={12} /> TERMINAL COMMAND</span>;
      case "analyze_file":
        return <span className="action-badge badge-file"><FileSearch size={12} /> FILE ANALYSIS</span>;
      case "write_file":
        return <span className="action-badge badge-write"><FileEdit size={12} /> FILE WRITE</span>;
      case "rename_file":
        return <span className="action-badge badge-rename"><Tag size={12} /> RENAME FILE</span>;
      case "delete_file":
        return <span className="action-badge badge-delete"><AlertTriangle size={12} /> PERMANENT DELETION</span>;
      case "web_fetch":
        return <span className="action-badge badge-web"><Globe size={12} /> WEB RESEARCH</span>;
      case "open_url":
        return <span className="action-badge badge-web"><Globe size={12} /> OPEN IN BROWSER</span>;
      case "launch_app":
        return <span className="action-badge badge-cmd"><Rocket size={12} /> LAUNCH APP</span>;
      default:
        return <span className="action-badge badge-cmd">ACTION REQUEST</span>;
    }
  };

  const renderContent = () => {
    if (isExecuting && !action) {
      return (
        <div className="action-executing-box">
          <div className="action-spinner" />
          <p className="action-exec-text">Momo is executing task step in workspace...</p>
        </div>
      );
    }

    if (!action) return null;

    switch (action.type) {
      case "command":
        return (
          <div className="action-details">
            <p className="action-question">Allow Momo to run this terminal command?</p>
            <div className="code-block-preview">
              <code>$ {action.command}</code>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "analyze_file":
        return (
          <div className="action-details">
            <p className="action-question">Allow Momo to inspect this file?</p>
            <div className="code-block-preview file-preview">
              <code><File size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.path}</code>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "write_file":
        return (
          <div className="action-details">
            <p className="action-question">Allow Momo to write changes to this file?</p>
            <div className="code-block-preview file-preview">
              <code><FileEdit size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.path}</code>
            </div>
            {action.content && (
              <pre className="content-snippet-box">
                {action.content.length > 300
                  ? `${action.content.slice(0, 300)}...\n(${action.content.length} characters total)`
                  : action.content}
              </pre>
            )}
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "rename_file":
        return (
          <div className="action-details">
            <p className="action-question">Allow Momo to rename this file/folder?</p>
            <div className="rename-flow-preview">
              <span className="rename-old"><File size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.path}</span>
              <span className="rename-arrow">→</span>
              <span className="rename-new"><Sparkles size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.newPath}</span>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "delete_file":
        return (
          <div className="action-details deletion-box">
            <p className="deletion-warning-title"><AlertTriangle size={14} /> PERMANENT DELETION WARNING</p>
            <p className="action-question deletion-text">
              Are you sure you want to permanently delete this file or directory? This cannot be undone!
            </p>
            <div className="code-block-preview delete-preview">
              <code><Trash2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.path}</code>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "web_fetch":
        return (
          <div className="action-details">
            <p className="action-question">Allow Momo to fetch web documentation?</p>
            <div className="code-block-preview web-preview">
              <code><Link size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.url}</code>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "open_url":
        return (
          <div className="action-details">
            <p className="action-question">
              Allow Momo to open this web address in {action.browser ? action.browser.toUpperCase() : "your browser"}?
            </p>
            <div className="code-block-preview web-preview">
              <code><Link size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.url}</code>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );

      case "launch_app":
        return (
          <div className="action-details">
            <p className="action-question">
              Allow Momo to launch <strong>{action.target}</strong>
              {action.arg ? ` with argument "${action.arg}"` : ""}?
            </p>
            <div className="code-block-preview">
              <code><Rocket size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{action.target} {action.arg || ""}</code>
            </div>
            {action.reason && <p className="action-reason"><Lightbulb size={12} /> {action.reason}</p>}
          </div>
        );
    }
  };

  const stepCount = agentCheckpoint
    ? agentCheckpoint.completedSteps.length + (pendingAction ? 1 : 0)
    : 1;
  const maxSteps = agentCheckpoint?.maxSteps || settings.maxAgentSteps || 25;

  return (
    <div className={`action-modal-backdrop ${isOverlayMode ? "mode-overlay" : "mode-dashboard"}`}>
      <div className={`action-modal-card ${actionType === "delete_file" ? "card-danger" : ""}`}>
        {/* Header */}
        <div className="action-modal-header">
          <div className="badge-row">
            {renderBadge()}
            {agentCheckpoint && (
              <span className="agent-step-pill">
                Step {stepCount}/{maxSteps}
              </span>
            )}
          </div>
          {agentCheckpoint && (
            <button
              type="button"
              className="stop-agent-btn"
              onClick={stopAgentLoop}
              title="Halt remaining agent steps"
            >
              <Square size={12} /> Stop Agent
            </button>
          )}
        </div>

        {/* Workspace Scope Indicator */}
        <div className="workspace-scope-row">
          <span className="scope-label">Folder Scope:</span>
          <span className="scope-path" title={settings.workspaceFolder || "No folder chosen"}>
            {settings.workspaceFolder ? settings.workspaceFolder : "Default (None Granted)"}
          </span>
          {!settings.workspaceFolder && (
            <button
              type="button"
              className="btn-select-folder"
              onClick={() => chooseWorkspaceFolder()}
            >
              <FolderOpen size={12} /> Select Folder
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="action-modal-body">{renderContent()}</div>

        {/* Footer Actions */}
        {!isExecuting && (
          <div className="action-modal-footer">
            <button
              type="button"
              className="btn-action btn-deny"
              onClick={handleDeny}
              disabled={isProcessing}
            >
              Deny
            </button>
            <button
              type="button"
              className={`btn-action btn-allow ${actionType === "delete_file" ? "btn-allow-danger" : ""}`}
              onClick={handleApprove}
              disabled={isProcessing}
            >
              {isProcessing
                ? "Executing..."
                : actionType === "delete_file"
                ? "Confirm Delete"
                : actionType === "open_url"
                ? "Allow & Open"
                : "Allow"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
