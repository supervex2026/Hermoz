/**
 * Types and contracts for Hermoz's provider-independent TTS system.
 * Designed to easily support Local Windows TTS (MVP) and future neural engines (Piper, Kokoro).
 */

export interface VoiceInfo {
  id: string;
  name: string;
  lang: string;
  isDefault?: boolean;
  localService?: boolean;
}

export interface TTSOptions {
  voiceId?: string | null;
  rate?: number; // 0.5 .. 2.0, default 1.0
  pitch?: number; // 0.5 .. 1.5, default 1.0
  volume?: number; // 0.0 .. 1.0, default 1.0
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: Error | string) => void;
}

export interface TTSProvider {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  getVoices(): Promise<VoiceInfo[]>;
  speak(text: string, options?: TTSOptions): Promise<void>;
  stop(): void;
  pause(): void;
  resume(): void;
}
