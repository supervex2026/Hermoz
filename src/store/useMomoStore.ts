import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { ttsManager } from "@/core/tts/manager";
import { cleanTextForSpeech } from "@/core/tts/cleaner";
import { audioRecorder, AudioRecorder } from "@/audio/recorder";
import { memoryStore } from "@/core/memory/memoryStore";
import { screenAnalyzer } from "@/core/vision/screenAnalyzer";
import type {
  AgentCheckpoint,
  AgentStepRecord,
  AppSettings,
  ChatMessage,
  Expression,
  InteractionMode,
  MomoAction,
  MomoActivity,
  MomoResponse,
  ProviderId,
  ProviderStatus,
  RequestContextPayload,
  VoiceInfo,
} from "@/types";
import { agentLoopManager } from "@/core/agent/agentLoop";
import { DEFAULT_SETTINGS } from "@/types";

/**
 * Strips markdown and extracts a punchy 1-2 sentence display text
 * (strictly under 90-100 characters) for the floating desktop bubble.
 */
function deriveSpeechDisplay(text: string): string {
  if (!text) return "";
  let clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[\*\-+]\s+/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= 90) return clean;

  const sentenceMatch = clean.match(/[^.!?]+[.!?]+/g);
  if (sentenceMatch && sentenceMatch.length > 0) {
    let candidate = sentenceMatch.slice(0, 2).join(" ").trim();
    if (candidate.length <= 95) return candidate;
    candidate = sentenceMatch[0].trim();
    if (candidate.length <= 95) return candidate;
  }

  const truncated = clean.slice(0, 90);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

const LOCAL_GREETINGS = [
  "You're finally here. What are we building today?",
  "Morning. Please tell me we're actually finishing something today.",
  "Oh good, a witness. Let's get to work.",
  "I was starting to think you'd forgotten about me.",
];

interface SendMessageOptions {
  forceTts?: boolean;
  image?: string;
  requireAgentic?: boolean;
}

interface MomoStore {
  // --- visual / activity state ---
  expression: Expression;
  activity: MomoActivity;
  bubbleText: string | null;
  interactionMode: InteractionMode;
  setBubble: (text: string | null, expression?: Expression) => void;
  setInteractionMode: (mode: InteractionMode) => void;

  // --- panels ---
  activeTab: "overview" | "vision" | "workspace" | "memory" | "settings";
  setActiveTab: (tab: "overview" | "vision" | "workspace" | "memory" | "settings") => void;
  chatOpen: boolean;
  settingsOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  togglePandaMenu: () => void;

  // --- chat ---
  messages: ChatMessage[];
  isSending: boolean;
  sendMessage: (text: string, options?: SendMessageOptions) => Promise<void>;
  clearChat: () => void;
  speakMessage: (text: string) => Promise<void>;

  // --- Agent & Actions ---
  pendingAction: MomoAction | null;
  agentCheckpoint: AgentCheckpoint | null;
  approvePendingAction: () => Promise<void>;
  denyPendingAction: () => void;
  stopAgentLoop: () => void;
  chooseWorkspaceFolder: () => Promise<string | null>;

  // --- Screen Capture Confirmation ---
  capturePromptOpen: boolean;
  promptCaptureConfirmation: (cb: (hideFirst: boolean | null) => void) => void;
  resolveCaptureConfirmation: (hideFirst: boolean | null) => void;
  captureScreenWithCheck: () => Promise<string | null>;

  // --- settings ---
  settings: AppSettings;
  settingsLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  saveApiKey: (provider: ProviderId, key: string) => Promise<void>;
  clearApiKey: (provider: ProviderId) => Promise<void>;
  setProviderPriority: (priority: ProviderId[]) => Promise<void>;

  // --- provider health ---
  providerStatus: ProviderStatus[];
  refreshProviderStatus: () => Promise<void>;

  // --- TTS & Voice ---
  voices: VoiceInfo[];
  loadVoices: () => Promise<void>;
  isSpeaking: boolean;
  stopSpeaking: () => void;
  testVoice: () => Promise<void>;

  // --- Push-to-Talk (PTT) ---
  isRecording: boolean;
  audioLevel: number;
  activeMicName: string | null;
  checkActiveMic: () => Promise<boolean>;
  startPTT: () => Promise<void>;
  stopPTT: () => Promise<void>;

  // --- lifecycle ---
  greet: () => Promise<void>;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const useMomoStore = create<MomoStore>((set, get) => {
  // Subscribe to TTSManager speaking state changes to keep visual animation in sync
  ttsManager.onSpeakingChange((speaking) => {
    set({ isSpeaking: speaking });
    if (speaking) {
      set({ activity: "speaking" });
    } else {
      if (get().activity === "speaking") {
        set({ activity: "idle" });
      }
    }
  });

  return {
    expression: "neutral",
    activity: "idle",
    bubbleText: null,
    interactionMode: "normal",
    setBubble: (text, expression) =>
      set((s) => ({ bubbleText: text, expression: expression ?? s.expression })),
    setInteractionMode: (mode) => set({ interactionMode: mode }),

    activeTab: "overview",
    setActiveTab: (tab) => set({ activeTab: tab }),

    chatOpen: false,
    settingsOpen: false,
    openChat: () => set({ chatOpen: true, settingsOpen: false }),
    closeChat: () => set({ chatOpen: false }),
    openSettings: () => set({ settingsOpen: true, chatOpen: false }),
    closeSettings: () => set({ settingsOpen: false }),
    togglePandaMenu: () =>
      set((s) => (s.chatOpen || s.settingsOpen ? { chatOpen: false, settingsOpen: false } : { chatOpen: true })),

    pendingAction: null,
    agentCheckpoint: null,

    capturePromptOpen: false,
    promptCaptureConfirmation: (cb) => {
      (get() as any)._captureCallback = cb;
      set({ capturePromptOpen: true });
    },
    resolveCaptureConfirmation: (hideFirst) => {
      const cb = (get() as any)._captureCallback;
      set({ capturePromptOpen: false });
      (get() as any)._captureCallback = null;
      if (cb) {
        cb(hideFirst);
      }
    },
    captureScreenWithCheck: async () => {
      const { settings, promptCaptureConfirmation } = get();
      if (settings.excludeFromCapture !== false) {
        return await screenAnalyzer.captureScreenBase64();
      }

      return new Promise<string | null>((resolve) => {
        promptCaptureConfirmation(async (hideFirst) => {
          if (hideFirst === null) {
            resolve(null);
            return;
          }
          try {
            if (hideFirst) {
              try {
                await invoke("set_exclude_from_capture", { enabled: true });
                await new Promise((r) => setTimeout(r, 60));
              } catch (e) {
                console.warn("Temporary exclude_from_capture failed:", e);
              }
            }
            const img = await screenAnalyzer.captureScreenBase64();
            if (hideFirst) {
              try {
                await invoke("set_exclude_from_capture", { enabled: false });
              } catch (e) {
                console.warn("Restoring exclude_from_capture failed:", e);
              }
            }
            resolve(img);
          } catch (err) {
            console.error("captureScreenWithCheck failed:", err);
            resolve(null);
          }
        });
      });
    },

    messages: [],
    isSending: false,
    sendMessage: async (text: string, options?: SendMessageOptions) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // 1. Immediately cut off any ongoing speech
      ttsManager.stop();

      // 2. Extract facts / projects / preferences into canonical long-term memory
      memoryStore.extractMemoryCandidates(trimmed);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };

      set((s) => ({
        messages: [...s.messages, userMsg],
        isSending: true,
        activity: "thinking",
        expression: "thinking",
      }));

      // Persist user message immediately to disk
      invoke("persist_message", {
        message: {
          id: userMsg.id,
          role: userMsg.role,
          content: userMsg.content,
          timestamp: userMsg.createdAt,
        },
      }).catch(() => {});

      try {
        const history = get().messages.slice(-12).map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }));

        // 3. Build unified canonical Momo context
        const contextPayload: RequestContextPayload = {
          memories: memoryStore.getRelevantMemories(trimmed, 6),
          activeProject: memoryStore.getActiveProject() || undefined,
          currentTask: memoryStore.getCurrentTask() || undefined,
          interactionMode: get().interactionMode,
          screenContext: screenAnalyzer.getContextString() || undefined,
        };

        const hasActionIntent =
          /open|launch|run|exec|build|compile|test|check|create|write|delete|rename|search|scrape|fetch|youtube|browser|brave|chrome|edge|github|git|npm|cargo|file/i.test(
            trimmed
          );
        const isAgenticNeeded =
          options?.requireAgentic || Boolean(get().agentCheckpoint) || hasActionIntent;
        const response = await invoke<MomoResponse>("ai_generate", {
          request: {
            message: trimmed,
            history,
            personality: get().settings.personality,
            context: contextPayload,
            image: options?.image,
            requireAgentic: isAgenticNeeded,
          },
        });

        const displayBubble =
          response.speechDisplay ||
          response.bubbleText ||
          deriveSpeechDisplay(response.message);

        // Check for agent action proposal
        if (response.action) {
          const action = response.action;
          let cp = get().agentCheckpoint;
          if (!cp || cp.status === "completed" || cp.status === "stopped") {
            cp = agentLoopManager.initTask(
              trimmed,
              response.provider,
              get().settings.maxAgentSteps || 25,
            );
          }
          agentLoopManager.updateCheckpoint({
            pendingAction: action,
            status: "awaiting_approval",
          });
          set({
            pendingAction: action,
            agentCheckpoint: agentLoopManager.getCheckpoint(),
          });
        } else if (get().agentCheckpoint && get().agentCheckpoint?.status !== "completed") {
          // Goal complete
          agentLoopManager.updateCheckpoint({
            status: "completed",
            pendingAction: null,
          });
          set({
            pendingAction: null,
            agentCheckpoint: agentLoopManager.getCheckpoint(),
          });
        }

        const momoMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "momo",
          content: response.message, // 1. FULL RESPONSE: complete answer strictly to Chat Panel
          bubbleText: displayBubble, // 2. SPEECH DISPLAY TEXT: punchy 1-2 sentence version
          speechDisplay: displayBubble,
          createdAt: Date.now(),
          provider: response.provider,
          interactionMode: response.interactionMode,
          action: response.action,
        };

        set((s) => ({
          messages: [...s.messages, momoMsg],
          isSending: false,
          activity: "speaking",
          expression: response.emotion,
          interactionMode: response.interactionMode,
          // Floating overlay receives ONLY the compact 1-2 sentence punchy bubble text!
          bubbleText: s.chatOpen ? null : displayBubble,
        }));

        // Persist assistant message to disk
        invoke("persist_message", {
          message: {
            id: momoMsg.id,
            role: momoMsg.role,
            content: momoMsg.content,
            bubbleText: momoMsg.bubbleText,
            provider: momoMsg.provider,
            timestamp: momoMsg.createdAt,
          },
        }).catch(() => {});

        const { settings } = get();
        const shouldSpeak =
          !settings.muteMomo &&
          settings.ttsEnabled &&
          (options?.forceTts || settings.speakChatResponses) &&
          response.speak;

        if (shouldSpeak) {
          // 3. TTS TEXT: Spoken via cleanTextForSpeech
          ttsManager
            .speak(cleanTextForSpeech(response.message), {
              voiceId: settings.selectedVoice,
              rate: settings.ttsSpeed,
              pitch: settings.ttsPitch,
              volume: settings.ttsVolume,
              onEnd: () => {
                if (get().activity === "speaking") {
                  set({ activity: "idle" });
                }
              },
              onError: (err) => {
                console.warn("TTS speak warning:", err);
                if (get().activity === "speaking") {
                  set({ activity: "idle" });
                }
              },
            })
            .catch(() => {});
        } else {
          // Fallback timer if not speaking out loud
          setTimeout(() => {
            if (get().activity === "speaking") set({ activity: "idle" });
          }, 2600);
        }

        get().refreshProviderStatus();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "All AI providers are currently unavailable.";

        const momoMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "momo",
          content: `Bro, my brain is having a network moment (${message}). Check Settings → Providers.`,
          bubbleText: "Network hiccup. Check Settings.",
          createdAt: Date.now(),
        };

        set((s) => ({
          messages: [...s.messages, momoMsg],
          isSending: false,
          activity: "idle",
          expression: "concerned",
          bubbleText: s.chatOpen ? null : momoMsg.bubbleText,
        }));
        get().refreshProviderStatus();
      }
    },

    clearChat: () => {
      set({ messages: [] });
    },

    speakMessage: async (text: string) => {
      const { settings } = get();
      if (!text) return;
      try {
        set({ isSpeaking: true, activity: "speaking" });
        await ttsManager.speak(text, {
          voiceId: settings.selectedVoice,
          rate: settings.ttsSpeed,
          pitch: settings.ttsPitch,
          volume: settings.ttsVolume,
          onEnd: () => {
            set({ isSpeaking: false });
            if (get().activity === "speaking") set({ activity: "idle" });
          },
          onError: () => {
            set({ isSpeaking: false });
            if (get().activity === "speaking") set({ activity: "idle" });
          },
        });
      } catch {
        set({ isSpeaking: false });
        if (get().activity === "speaking") set({ activity: "idle" });
      }
    },

    approvePendingAction: async () => {
      const { pendingAction, settings, agentCheckpoint } = get();
      if (!pendingAction) return;

      const action = pendingAction;
      set({ pendingAction: null });

      if (agentCheckpoint) {
        agentLoopManager.updateCheckpoint({ status: "executing" });
        set({ agentCheckpoint: agentLoopManager.getCheckpoint() });
      }

      try {
        const execRes = await agentLoopManager.executeApprovedAction(
          action,
          settings.workspaceFolder,
        );

        const stepNumber = (agentCheckpoint?.completedSteps.length || 0) + 1;
        const record: AgentStepRecord = {
          stepNumber,
          action,
          fullOutput: execRes.fullOutput,
          truncatedOutput: execRes.truncatedOutput,
          exitCode: execRes.exitCode,
          status: execRes.isSuccess ? "success" : "failed",
        };

        const updatedSteps = [...(agentCheckpoint?.completedSteps || []), record];
        agentLoopManager.updateCheckpoint({
          completedSteps: updatedSteps,
          lastOutput: execRes.truncatedOutput,
          pendingAction: null,
          stepCount: stepNumber,
        });
        set({ agentCheckpoint: agentLoopManager.getCheckpoint() });

        // Check if maximum steps reached
        const maxSteps = agentCheckpoint?.maxSteps || settings.maxAgentSteps || 25;
        if (stepNumber >= maxSteps) {
          agentLoopManager.updateCheckpoint({ status: "completed" });
          set({ agentCheckpoint: agentLoopManager.getCheckpoint() });
          await get().sendMessage(
            `[AGENT LOOP LIMIT: Reached maximum of ${maxSteps} steps. Summarize what has been achieved so far and report to the user.]`,
            { requireAgentic: true }
          );
          return;
        }

        // Build deterministic next turn prompt for the loop
        const nextTurnPrompt = agentLoopManager.buildNextTurnPrompt(
          stepNumber,
          action,
          execRes.truncatedOutput,
          execRes.isSuccess,
          execRes.exitCode,
        );

        // Continue agent loop without user re-prompting!
        await get().sendMessage(nextTurnPrompt, { requireAgentic: true });
      } catch (err) {
        console.error("Action execution failed:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        agentLoopManager.updateCheckpoint({ status: "failed" });
        set({ agentCheckpoint: agentLoopManager.getCheckpoint() });

        await get().sendMessage(
          `[AGENT LOOP ERROR: Action execution threw an exception: ${errMsg}. Inform the user and suggest a recovery step.]`,
          { requireAgentic: true }
        );
      }
    },

    denyPendingAction: () => {
      const { agentCheckpoint } = get();
      if (agentCheckpoint) {
        agentLoopManager.updateCheckpoint({
          status: "stopped",
          pendingAction: null,
        });
        set({
          pendingAction: null,
          agentCheckpoint: agentLoopManager.getCheckpoint(),
        });
      } else {
        set({ pendingAction: null });
      }
      get().setBubble("Action cancelled.");
    },

    stopAgentLoop: () => {
      agentLoopManager.stopTask();
      set({
        pendingAction: null,
        agentCheckpoint: agentLoopManager.getCheckpoint(),
      });
      get().setBubble("Agent stopped.");
    },

    chooseWorkspaceFolder: async () => {
      try {
        const folder = await invoke<string | null>("choose_workspace_folder");
        if (folder) {
          await get().updateSettings({ workspaceFolder: folder });
          return folder;
        }
      } catch (err) {
        console.warn("choose_workspace_folder failed:", err);
      }
      return null;
    },

    settings: DEFAULT_SETTINGS,
    settingsLoaded: false,
    loadSettings: async () => {
      try {
        const settings = await invoke<AppSettings>("get_settings");
        set({ settings, settingsLoaded: true });
      } catch {
        // Running outside Tauri (browser preview) - keep defaults.
        set({ settingsLoaded: true });
      }

      // Load canonical persistent chat history
      try {
        const canonical = await invoke<{
          messages?: Array<{
            id: string;
            role: string;
            content: string;
            bubbleText?: string;
            provider?: string;
            timestamp: number;
          }>;
          interactionMode?: string;
        }>("get_canonical_state");

        if (canonical && Array.isArray(canonical.messages) && canonical.messages.length > 0) {
          const loadedMsgs: ChatMessage[] = canonical.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "momo",
            content: m.content,
            bubbleText: m.bubbleText,
            createdAt: m.timestamp,
            provider: m.provider as ProviderId | undefined,
          }));
          set({ messages: loadedMsgs });
        }
        if (canonical?.interactionMode) {
          set({ interactionMode: canonical.interactionMode as InteractionMode });
        }
      } catch {
        // Outside Tauri
      }

      get().loadVoices();
      get().checkActiveMic();
    },

    updateSettings: async (partial) => {
      const next = { ...get().settings, ...partial };
      set({ settings: next });
      if (partial.excludeFromCapture !== undefined) {
        invoke("set_exclude_from_capture", { enabled: partial.excludeFromCapture }).catch(() => {});
      }
      try {
        await invoke("update_settings", { newSettings: next });
      } catch {
        /* best-effort in browser preview */
      }
    },

    saveApiKey: async (provider, key) => {
      await invoke("save_api_key", { provider, key });
      set((s) => ({
        settings: {
          ...s.settings,
          hasGroqKey: provider === "groq" ? true : s.settings.hasGroqKey,
          hasOpenRouterKey: provider === "openrouter" ? true : s.settings.hasOpenRouterKey,
          hasGeminiKey: provider === "gemini" ? true : s.settings.hasGeminiKey,
        },
      }));
      get().refreshProviderStatus();
    },

    clearApiKey: async (provider) => {
      await invoke("clear_api_key", { provider });
      set((s) => ({
        settings: {
          ...s.settings,
          hasGroqKey: provider === "groq" ? false : s.settings.hasGroqKey,
          hasOpenRouterKey: provider === "openrouter" ? false : s.settings.hasOpenRouterKey,
          hasGeminiKey: provider === "gemini" ? false : s.settings.hasGeminiKey,
        },
      }));
      get().refreshProviderStatus();
    },

    setProviderPriority: async (priority) => {
      const next = { ...get().settings, providerPriority: priority };
      set({ settings: next });
      try {
        await invoke("update_settings", { newSettings: next });
      } catch {
        /* best-effort in browser preview */
      }
    },

    providerStatus: [],
    refreshProviderStatus: async () => {
      try {
        const status = await invoke<ProviderStatus[]>("get_provider_status");
        set({ providerStatus: status });
      } catch {
        /* ignore in browser preview */
      }
    },

    // --- TTS & Voice ---
    voices: [],
    loadVoices: async () => {
      const list = await ttsManager.getVoices();
      set({ voices: list });
    },
    isSpeaking: false,
    stopSpeaking: () => {
      ttsManager.stop();
      if (get().activity === "speaking") {
        set({ activity: "idle" });
      }
    },
    testVoice: async () => {
      const { settings } = get();
      if (settings.muteMomo) {
        set({ bubbleText: "Momo is muted in Settings.", expression: "annoyed" });
        return;
      }
      set({ expression: "happy", bubbleText: "Yo. This is Momo. Yeah, I can talk." });
      await ttsManager.speak("Yo. This is Momo. Yeah, I can talk.", {
        voiceId: settings.selectedVoice,
        rate: settings.ttsSpeed,
        pitch: settings.ttsPitch,
        volume: settings.ttsVolume,
      });
    },

    // --- Push-to-Talk (PTT) ---
    isRecording: false,
    audioLevel: 0,
    activeMicName: null,
    checkActiveMic: async () => {
      const hasMic = await AudioRecorder.hasActiveMicrophone();
      const name = await AudioRecorder.getActiveMicrophoneName();
      set({ activeMicName: name });
      return hasMic;
    },
    startPTT: async () => {
      if (get().isRecording) return;

      // 1. Immediately cut off any ongoing speech
      ttsManager.stop();

      // 2. Verify microphone hardware
      const hasMic = await AudioRecorder.hasActiveMicrophone();
      if (!hasMic) {
        set({
          expression: "concerned",
          activity: "idle",
          bubbleText: "No active mic detected! Check your mic.",
        });
        setTimeout(() => {
          if (get().bubbleText?.includes("No active mic")) {
            set({ bubbleText: null });
          }
        }, 4000);
        return;
      }

      const micName = await AudioRecorder.getActiveMicrophoneName();

      // 3. Enter listening state
      set({
        isRecording: true,
        activity: "listening",
        expression: "happy",
        bubbleText: "Listening...",
        activeMicName: micName,
      });

      try {
        await audioRecorder.start((level) => {
          set({ audioLevel: level });
        });
      } catch (err) {
        console.warn("Microphone access failed:", err);
        set({
          isRecording: false,
          activity: "idle",
          expression: "concerned",
          bubbleText: "Microphone busy or denied.",
        });
      }
    },
    stopPTT: async () => {
      if (!get().isRecording) return;

      set({ isRecording: false, audioLevel: 0 });
      const result = await audioRecorder.stop();

      // If user tapped F1 too fast (< 400ms), don't send garbage
      if (!result || result.durationMs < 400) {
        set({
          activity: "idle",
          expression: "neutral",
          bubbleText: "Hold F1 while speaking.",
        });
        setTimeout(() => {
          if (get().bubbleText?.includes("Hold F1")) {
            set({ bubbleText: null });
          }
        }, 2500);
        return;
      }

      // Enter thinking / transcribing state
      set({
        activity: "thinking",
        expression: "thinking",
        bubbleText: "Hold up...",
      });

      try {
        const text = await invoke<string>("transcribe_audio", {
          audioData: Array.from(result.buffer),
          format: result.format,
        });

        if (!text || !text.trim()) {
          set({
            activity: "idle",
            expression: "confused",
            bubbleText: "Didn't catch that. Say again?",
          });
          return;
        }

        // Send transcribed message to AI and force audio response via TTS
        await get().sendMessage(text.trim(), { forceTts: true });
      } catch (err) {
        console.warn("Transcription failed:", err);
        const errMsg =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Transcription error";

        set({
          activity: "idle",
          expression: "concerned",
          bubbleText: `Couldn't hear that: ${errMsg}`,
        });
      }
    },

    greet: async () => {
      const { settings } = get();
      if (!settings.hasGroqKey && !settings.hasOpenRouterKey && !settings.hasGeminiKey) {
        set({ bubbleText: pickRandom(LOCAL_GREETINGS), expression: "happy" });
        return;
      }
      try {
        const response = await invoke<MomoResponse>(
          "ai_generate",
          {
            request: {
              message: "[system: the user just opened the app after being away]",
              history: [],
              personality: settings.personality,
              context: {
                memories: memoryStore.getRelevantMemories("greeting", 4),
                activeProject: memoryStore.getActiveProject() || undefined,
              },
            },
          },
        );
        const displayBubble =
          response.speechDisplay ||
          response.bubbleText ||
          deriveSpeechDisplay(response.message);
        set({
          bubbleText: displayBubble,
          expression: response.emotion,
          interactionMode: response.interactionMode,
        });
        if (!settings.muteMomo && settings.ttsEnabled && settings.speakProactiveMessages && response.speak) {
          ttsManager
            .speak(cleanTextForSpeech(response.message), {
              voiceId: settings.selectedVoice,
              rate: settings.ttsSpeed,
              pitch: settings.ttsPitch,
              volume: settings.ttsVolume,
            })
            .catch(() => {});
        }
      } catch {
        set({ bubbleText: pickRandom(LOCAL_GREETINGS), expression: "happy" });
      }
    },
  };
});
