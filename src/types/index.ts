/**
 * Shared types for the Hermoz frontend.
 *
 * Mirrors the Rust-side structs in src-tauri/src/ai/types.rs,
 * src-tauri/src/storage/state_store.rs, and src-tauri/src/state.rs.
 */

export type Expression =
  | "neutral"
  | "happy"
  | "laughing"
  | "annoyed"
  | "confused"
  | "surprised"
  | "sleepy"
  | "thinking"
  | "angry"
  | "smug"
  | "excited"
  | "sad"
  | "concerned"
  | "teasing"
  | "arguing"
  | "roasting"
  | "agreeing"
  | "disagreeing"
  | "error"
  | "offline"
  | "visionActive";

export type HermozActivity =
  | "idle"
  | "observing"
  | "thinking"
  | "speaking"
  | "listening"
  | "sleeping"
  | "arguing"
  | "roasting"
  | "visionActive";

export interface HermozVisualState {
  expression: Expression;
  activity: HermozActivity;
}

export type ChatRole = "user" | "hermoz";

export type ProviderId = "groq" | "openrouter" | "gemini";

export type InteractionMode =
  | "normal"
  | "playful"
  | "teasing"
  | "argument"
  | "supportive"
  | "serious"
  | "focused";

export type HermozActionType =
  | "command"
  | "analyze_file"
  | "write_file"
  | "rename_file"
  | "delete_file"
  | "web_fetch"
  | "open_url"
  | "launch_app"
  | "generate_ui"
  | "install_skill";

export interface HermozAction {
  type: HermozActionType;
  command?: string;
  path?: string;
  newPath?: string;
  content?: string;
  url?: string;
  browser?: string;
  target?: string;
  arg?: string | null;
  reason?: string;
}

export interface AgentStepRecord {
  stepNumber: number;
  action: HermozAction;
  fullOutput: string;
  truncatedOutput: string;
  exitCode?: number;
  durationMs?: number;
  status: "success" | "failed";
}

export interface AgentCheckpoint {
  taskId: string;
  goal: string;
  completedSteps: AgentStepRecord[];
  lastOutput: string;
  pendingAction: HermozAction | null;
  stepCount: number;
  maxSteps: number;
  activeProvider: ProviderId;
  status:
    | "idle"
    | "planning"
    | "awaiting_approval"
    | "executing"
    | "completed"
    | "failed"
    | "stopped";
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  bubbleText?: string;
  speechDisplay?: string;
  provider?: ProviderId;
  interactionMode?: InteractionMode;
  action?: HermozAction;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  folder?: string;
}

export type ProviderHealthState =
  | "connected"
  | "rate_limited"
  | "error"
  | "unconfigured";

export interface ProviderStatus {
  id: ProviderId;
  state: ProviderHealthState;
  retryAfter?: number;
  lastError?: string;
}

/**
 * Normalized Hermoz AI response contract
 */
export interface HermozResponse {
  message: string;
  bubbleText: string;
  speechDisplay?: string;
  emotion: Expression;
  interactionMode: InteractionMode;
  speak: boolean;
  animation: string;
  provider: ProviderId;
  action?: HermozAction;
}

export type RoastLevel = 0 | 1 | 2 | 3;
export type Proactivity = "low" | "medium" | "high";
export type Seriousness = "casual" | "balanced" | "serious";
export type CompanionStyle = "friendly" | "chaotic" | "mentor" | "sarcastic";

export interface PersonalityConfig {
  roastLevel: RoastLevel;
  proactivity: Proactivity;
  seriousness: Seriousness;
  style: CompanionStyle;
}

export interface WindowPosition {
  x: number;
  y: number;
}

export type { VoiceInfo } from "@/core/tts/types";

export interface AppSettings {
  personality: PersonalityConfig;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  launchAtStartup: boolean;
  ttsEnabled: boolean;
  ttsVolume: number; // 0..1
  ttsSpeed: number; // 0.5..2
  ttsPitch: number; // 0.5..1.5
  selectedVoice: string | null;
  muteHermoz: boolean;
  speakProactiveMessages: boolean;
  speakChatResponses: boolean;
  proactiveCooldownSeconds: number;
  windowPosition: WindowPosition | null;
  hasGroqKey: boolean;
  hasOpenRouterKey: boolean;
  hasGeminiKey: boolean;
  providerPriority: ProviderId[];
  overlayMode?: boolean;
  workspaceFolder?: string;
  maxAgentSteps?: number;
  excludeFromCapture?: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  personality: {
    roastLevel: 2,
    proactivity: "medium",
    seriousness: "balanced",
    style: "friendly",
  },
  alwaysOnTop: true,
  clickThrough: false,
  launchAtStartup: false,
  ttsEnabled: true,
  ttsVolume: 0.8,
  ttsSpeed: 1.0,
  ttsPitch: 1.0,
  selectedVoice: null,
  muteHermoz: false,
  speakProactiveMessages: true,
  speakChatResponses: true,
  proactiveCooldownSeconds: 120,
  windowPosition: null,
  hasGroqKey: false,
  hasOpenRouterKey: false,
  hasGeminiKey: false,
  providerPriority: ["groq", "openrouter", "gemini"],
  overlayMode: true,
  workspaceFolder: undefined,
  maxAgentSteps: 25,
  excludeFromCapture: true,
};

export type MemoryCategory =
  | "USER_PROFILE"
  | "PREFERENCE"
  | "PROJECT"
  | "PROJECT_GOAL"
  | "CURRENT_TASK"
  | "IMPORTANT_FACT"
  | "RELATIONSHIP"
  | "INSIDE_JOKE"
  | "CONVERSATION_SUMMARY";

export interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  importance: "high" | "normal" | "low";
  createdAt: number;
}

export interface ScreenContext {
  application: string;
  activity: string;
  visibleElements: string[];
  likelyTask: string;
  confidence: number;
  timestamp: number;
  isoTimestamp?: string;
  isStale: boolean;
}

export interface SendMessageOptions {
  forceTts?: boolean;
  image?: string;
  requireAgentic?: boolean;
}

export interface RequestContextPayload {
  memories: string[];
  activeProject?: string;
  currentTask?: string;
  interactionMode?: string;
  argumentContext?: string;
  screenContext?: string;
  userProfile?: string;
  loadedSkills?: string;
}
