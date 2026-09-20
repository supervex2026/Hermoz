import { cleanTextForSpeech } from "./cleaner";
import { LocalTTSProvider } from "./local";
import type { TTSOptions, TTSProvider, VoiceInfo } from "./types";

type SpeakingListener = (isSpeaking: boolean) => void;

/**
 * TTSManager
 * Central coordinator for all Text-to-Speech playback in Momo.
 * The rest of the application interacts exclusively with this manager.
 */
export class TTSManager {
  private static instance: TTSManager | null = null;

  private providers: Map<string, TTSProvider> = new Map();
  private activeProviderId: string = "local-windows";
  private speaking: boolean = false;
  private listeners: Set<SpeakingListener> = new Set();

  private constructor() {
    // Register default MVP provider: Local Windows TTS
    const local = new LocalTTSProvider();
    this.registerProvider(local);
  }

  public static getInstance(): TTSManager {
    if (!TTSManager.instance) {
      TTSManager.instance = new TTSManager();
    }
    return TTSManager.instance;
  }

  /**
   * Register a new TTS provider (e.g., future Piper, Kokoro neural engines)
   */
  public registerProvider(provider: TTSProvider): void {
    this.providers.set(provider.id, provider);
  }

  public setActiveProvider(id: string): void {
    if (this.providers.has(id)) {
      this.stop();
      this.activeProviderId = id;
    }
  }

  public getActiveProvider(): TTSProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      // Fallback to first available
      return this.providers.values().next().value as TTSProvider;
    }
    return provider;
  }

  public async getVoices(): Promise<VoiceInfo[]> {
    const provider = this.getActiveProvider();
    if (!provider) return [];
    try {
      return await provider.getVoices();
    } catch (err) {
      console.warn("Error fetching voices from provider:", err);
      return [];
    }
  }

  /**
   * Prepare text through speech cleaner and speak via active provider
   */
  public async speak(rawText: string, options?: TTSOptions): Promise<void> {
    const provider = this.getActiveProvider();
    if (!provider) {
      options?.onError?.("No active TTS provider found");
      return;
    }

    const cleanText = cleanTextForSpeech(rawText);
    if (!cleanText) {
      return;
    }

    this.stop();

    const wrappedOptions: TTSOptions = {
      ...options,
      onStart: () => {
        this.setSpeaking(true);
        options?.onStart?.();
      },
      onEnd: () => {
        this.setSpeaking(false);
        options?.onEnd?.();
      },
      onError: (err) => {
        this.setSpeaking(false);
        options?.onError?.(err);
      },
    };

    try {
      await provider.speak(cleanText, wrappedOptions);
    } catch (err) {
      this.setSpeaking(false);
      options?.onError?.(err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Immediately stops any current utterance (crucial for PTT and user interruption)
   */
  public stop(): void {
    const provider = this.getActiveProvider();
    if (provider) {
      provider.stop();
    }
    this.setSpeaking(false);
  }

  public pause(): void {
    const provider = this.getActiveProvider();
    if (provider) {
      provider.pause();
    }
  }

  public resume(): void {
    const provider = this.getActiveProvider();
    if (provider) {
      provider.resume();
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public onSpeakingChange(listener: SpeakingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setSpeaking(val: boolean): void {
    if (this.speaking !== val) {
      this.speaking = val;
      for (const listener of this.listeners) {
        try {
          listener(val);
        } catch (e) {
          console.error("Error in speaking state listener:", e);
        }
      }
    }
  }
}

export const ttsManager = TTSManager.getInstance();
