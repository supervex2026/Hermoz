import type { TTSOptions, TTSProvider, VoiceInfo } from "./types";

/**
 * Local Windows TTS Provider.
 * Uses the host system's speech synthesis engine via WebView2 / Web Speech API.
 * This utilizes native Windows voices (SAPI / OneCore) without cloud APIs, network calls, or heavy neural weights.
 */
export class LocalTTSProvider implements TTSProvider {
  readonly id = "local-windows";
  readonly name = "Windows Local Speech";

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  async getVoices(): Promise<VoiceInfo[]> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return [];
    }

    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      // Wait for voiceschanged event if voices haven't loaded into the webview yet
      await new Promise<void>((resolve) => {
        let timeout: ReturnType<typeof setTimeout>;
        const handler = () => {
          clearTimeout(timeout);
          window.speechSynthesis.removeEventListener("voiceschanged", handler);
          resolve();
        };
        timeout = setTimeout(() => {
          window.speechSynthesis.removeEventListener("voiceschanged", handler);
          resolve();
        }, 600);
        window.speechSynthesis.addEventListener("voiceschanged", handler);
      });
      voices = window.speechSynthesis.getVoices();
    }

    return voices.map((v) => ({
      id: v.voiceURI || v.name,
      name: v.name,
      lang: v.lang,
      isDefault: v.default,
      localService: v.localService,
    }));
  }

  speak(text: string, options?: TTSOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        options?.onError?.("Speech synthesis is not supported in this environment");
        return reject(new Error("speechSynthesis not available"));
      }

      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      // Rate: 0.5 .. 2.0 (default 1.0)
      if (typeof options?.rate === "number") {
        utterance.rate = Math.max(0.5, Math.min(2.0, options.rate));
      }

      // Pitch: 0.5 .. 1.5 (default 1.0)
      if (typeof options?.pitch === "number") {
        utterance.pitch = Math.max(0.5, Math.min(1.5, options.pitch));
      }

      // Volume: 0.0 .. 1.0 (default 1.0)
      if (typeof options?.volume === "number") {
        utterance.volume = Math.max(0.0, Math.min(1.0, options.volume));
      }

      // Match requested voice or pick best match (e.g. UK voice preference)
      const allVoices = window.speechSynthesis.getVoices();
      if (options?.voiceId) {
        const found = allVoices.find(
          (v) => (v.voiceURI && v.voiceURI === options.voiceId) || v.name === options.voiceId,
        );
        if (found) {
          utterance.voice = found;
        }
      }

      // If no voice set yet, look for a UK male or UK English voice if present
      if (!utterance.voice && allVoices.length > 0) {
        const ukVoice = allVoices.find(
          (v) =>
            v.lang.toLowerCase().startsWith("en-gb") ||
            v.name.toLowerCase().includes("george") ||
            v.name.toLowerCase().includes("alfie") ||
            v.name.toLowerCase().includes("hazel") ||
            v.name.toLowerCase().includes("united kingdom"),
        );
        if (ukVoice) {
          utterance.voice = ukVoice;
        }
      }

      utterance.onstart = () => {
        this.startKeepAlive();
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.clearKeepAlive();
        this.currentUtterance = null;
        options?.onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        this.clearKeepAlive();
        this.currentUtterance = null;
        // 'interrupted' or 'canceled' are expected when user stops or speaks again
        if (event.error !== "interrupted" && event.error !== "canceled") {
          console.warn("TTS playback error:", event.error);
          options?.onError?.(event.error);
        }
        options?.onEnd?.();
        resolve();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        this.clearKeepAlive();
        this.currentUtterance = null;
        options?.onError?.(err instanceof Error ? err.message : String(err));
        reject(err);
      }
    });
  }

  stop(): void {
    this.clearKeepAlive();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  pause(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
    }
  }

  resume(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
    }
  }

  private startKeepAlive(): void {
    this.clearKeepAlive();
    // Workaround for Chromium/WebView2 speech synthesis pause bug on long sentences
    this.keepAliveTimer = setInterval(() => {
      if (typeof window !== "undefined" && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
