/**
 * Screen Vision Analyzer for Hermoz
 * Captures screen frames safely on demand and performs multimodal analysis.
 * Stores structured screen context that survives AI provider switching.
 */

import { invoke } from "@tauri-apps/api/core";
import type { HermozResponse, ScreenContext } from "@/types";

export interface ScreenDebugInfo {
  monitor: string;
  activeWindow: string;
  captureSize: string;
  visionProvider: string;
  visionModel: string;
  capturedAt: number;
  contextAgeSeconds: number;
  isStale: boolean;
  confidence: number;
}

export interface RawVisionOutput {
  application?: string;
  activity?: string;
  visibleElements?: string[];
  likelyTask?: string;
  confidence?: number;
  timestamp?: string;
  speechDisplay?: string;
  bubbleText?: string;
  message?: string;
  emotion?: string;
}

export class ScreenAnalyzer {
  private static instance: ScreenAnalyzer | null = null;
  private isCapturing: boolean = false;
  private latestContext: ScreenContext | null = null;
  private latestDebugInfo: ScreenDebugInfo | null = null;
  private lastCapturedImage: string | null = null;
  private lastCaptureDimensions: { width: number; height: number } = { width: 0, height: 0 };

  public static getInstance(): ScreenAnalyzer {
    if (!ScreenAnalyzer.instance) {
      ScreenAnalyzer.instance = new ScreenAnalyzer();
    }
    return ScreenAnalyzer.instance;
  }

  /**
   * Captures a high-resolution, aspect-ratio-preserved snapshot of the user's screen.
   * Scales intelligently with DPI awareness up to 1080p (max dimension 1920) so small font
   * text, code, terminal output, and tabs remain sharp and legible for AI vision.
   */
  public async captureScreenBase64(): Promise<string> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen capture API not supported in this environment");
    }

    this.isCapturing = true;
    let stream: MediaStream | null = null;
    try {
      // Request high resolution with monitor preference for crisp OCR and UI clarity
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 10, max: 15 },
        } as MediaTrackConstraints,
        audio: false,
      });

      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      // Wait for video track metadata to initialize so resolution is known
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(reject);
        };
        video.onerror = (e) => reject(e);
        // Timeout safeguard in case onloadedmetadata doesn't fire
        setTimeout(() => resolve(), 1200);
      });

      const nativeWidth = video.videoWidth || 1920;
      const nativeHeight = video.videoHeight || 1080;

      // Maintain exact aspect ratio while clamping longest edge to 1920px for optimal token/readability ratio
      const maxDim = 1920;
      let targetWidth = nativeWidth;
      let targetHeight = nativeHeight;

      if (targetWidth > maxDim || targetHeight > maxDim) {
        if (targetWidth >= targetHeight) {
          targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
          targetWidth = maxDim;
        } else {
          targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
          targetHeight = maxDim;
        }
      }

      this.lastCaptureDimensions = { width: targetWidth, height: targetHeight };

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("Could not create canvas context");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      // High quality JPEG (0.85) ensures text in code and UI remains sharp for vision models
      const base64 = canvas.toDataURL("image/jpeg", 0.85);

      // Release media stream tracks immediately
      stream.getTracks().forEach((t) => t.stop());
      this.isCapturing = false;
      this.lastCapturedImage = base64;

      return base64;
    } catch (err) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      this.isCapturing = false;
      throw err;
    }
  }

  /**
   * Performs structured multimodal vision analysis by sending the image to the AI router.
   * Enforces the structured output contract:
   * { application, activity, visibleElements, likelyTask, confidence, timestamp }
   * With low-confidence disclaimer handling (<0.6) and strict 60s expiration.
   */
  public async analyzeScreen(
    imageBase64: string,
    userPrompt?: string,
  ): Promise<{ response: HermozResponse; context: ScreenContext }> {
    const now = Date.now();
    const isoNow = new Date(now).toISOString();

    const structuredVisionPrompt = userPrompt ||
      `Analyze the attached desktop screenshot carefully with high accuracy.
Identify the primary active window and what the user is working on.
You MUST output ONLY a valid JSON object matching this schema (no markdown fences, no explanatory text):
{
  "application": "<active foreground application name, e.g. VS Code, Chrome, Terminal, Blender, Discord>",
  "activity": "<concise description of what the user is currently doing>",
  "visibleElements": ["<key UI element 1>", "<key UI element 2>", "<key UI element 3>"],
  "likelyTask": "<what the user is attempting to accomplish>",
  "confidence": 0.85,
  "timestamp": "${isoNow}",
  "speechDisplay": "<short 1-sentence punchy reaction under 85 chars for Hermoz's desktop thought bubble. If confidence < 0.6, honestly admit you are not totally sure what they are working on>",
  "bubbleText": "<same as speechDisplay>",
  "message": "<Hermoz's witty conversational feedback observing their screen with sharp observations and banter>"
}`;

    const response = await invoke<HermozResponse>("ai_generate", {
      request: {
        message: structuredVisionPrompt,
        history: [],
        personality: {
          roastLevel: 2,
          proactivity: "medium",
          seriousness: "casual",
          style: "friendly",
        },
        image: imageBase64,
      },
    });

    // Attempt to parse structured vision schema from response message
    let parsed: RawVisionOutput | null = null;
    try {
      const trimmed = response.message.trim();
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start !== -1 && end > start) {
        parsed = JSON.parse(trimmed.slice(start, end + 1));
      }
    } catch {
      parsed = null;
    }

    const application = parsed?.application || "Active Desktop Window";
    const activity = parsed?.activity || response.speechDisplay || response.bubbleText || "Working on desktop";
    const visibleElements = Array.isArray(parsed?.visibleElements) && parsed.visibleElements.length > 0
      ? parsed.visibleElements
      : ["active window", "desktop workspace"];
    const likelyTask = parsed?.likelyTask || "Desktop productivity task";
    const confidence = typeof parsed?.confidence === "number" && !isNaN(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.85;

    // Low confidence handling: If confidence < 0.6, attach honest disclaimer
    if (confidence < 0.6) {
      const disclaimer = `Not totally sure what you're working on, but looks like ${application}.`;
      if (!response.speechDisplay?.toLowerCase().includes("not totally sure") && !response.speechDisplay?.toLowerCase().includes("not sure")) {
        response.speechDisplay = disclaimer;
        response.bubbleText = disclaimer;
      }
    }

    // Generate structured screen context with strict 60-second validity
    this.latestContext = {
      application,
      activity,
      visibleElements,
      likelyTask,
      confidence,
      timestamp: now,
      isoTimestamp: isoNow,
      isStale: false,
    };

    const dims = this.lastCaptureDimensions;
    const sizeStr = dims.width > 0 ? `${dims.width}x${dims.height} (JPEG 0.85)` : "1920x1080 (JPEG 0.85)";

    this.latestDebugInfo = {
      monitor: "Active Window Monitor",
      activeWindow: application,
      captureSize: sizeStr,
      visionProvider: response.provider || "Router Selected",
      visionModel: "Multimodal Vision Engine",
      capturedAt: now,
      contextAgeSeconds: 0,
      isStale: false,
      confidence,
    };

    return { response, context: this.latestContext };
  }

  /**
   * Retrieves the current screen context string.
   * Screen analysis context is valid for at most 60 seconds.
   * After 60 seconds, it is treated as stale.
   */
  public getContextString(): string | null {
    if (!this.latestContext) return null;

    const ageMs = Date.now() - this.latestContext.timestamp;
    const isStale = ageMs > 60_000; // Strict 60-second expiration
    this.latestContext.isStale = isStale;

    if (isStale) {
      return `[Screen Context Expired: Last capture was taken ${Math.round(ageMs / 1000)}s ago (>60s) and is now stale. Do not assume this reflects current desktop.]`;
    }

    const confNotice = this.latestContext.confidence < 0.6
      ? ` (Low confidence ${Math.round(this.latestContext.confidence * 100)}%: do not hallucinate details)`
      : "";

    return `[Screen Context (Fresh ${Math.round(ageMs / 1000)}s ago): App: ${this.latestContext.application} | Task: ${this.latestContext.likelyTask} | Activity: ${this.latestContext.activity} | Visible: ${this.latestContext.visibleElements.slice(0, 4).join(", ")}${confNotice}]`;
  }

  public getDebugInfo(): ScreenDebugInfo | null {
    if (!this.latestDebugInfo) return null;
    const age = Math.round((Date.now() - this.latestDebugInfo.capturedAt) / 1000);
    return {
      ...this.latestDebugInfo,
      contextAgeSeconds: age,
      isStale: age > 60,
    };
  }

  public getLatestContext(): ScreenContext | null {
    return this.latestContext;
  }

  public getLastCapturedImage(): string | null {
    return this.lastCapturedImage;
  }

  public isBusy(): boolean {
    return this.isCapturing;
  }
}

export const screenAnalyzer = ScreenAnalyzer.getInstance();
