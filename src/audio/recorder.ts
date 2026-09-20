/**
 * Audio Recorder & Microphone Device Manager for Push-to-Talk (PTT).
 */

export interface RecordingResult {
  blob: Blob;
  buffer: Uint8Array;
  durationMs: number;
  format: "webm" | "wav";
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;

  /**
   * Checks if any active audio input devices are connected.
   */
  public static async hasActiveMicrophone(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return false;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === "audioinput");
    } catch (err) {
      console.warn("Could not enumerate audio devices:", err);
      return false;
    }
  }

  /**
   * Retrieves the label of the active or default microphone.
   */
  public static async getActiveMicrophoneName(): Promise<string | null> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return null;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mic = devices.find((d) => d.kind === "audioinput" && d.deviceId !== "");
      return mic ? mic.label || "Microphone (Connected)" : null;
    } catch {
      return null;
    }
  }

  /**
   * Start recording from the microphone with optional live audio level callback (0.0 .. 1.0).
   */
  public async start(onAudioLevel?: (level: number) => void): Promise<void> {
    this.stop(); // reset any prior stream

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.audioStream = stream;
    this.chunks = [];
    this.startTime = Date.now();

    // Determine supported mimeType
    let mimeType = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    }

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    recorder.start(100); // 100ms slice for fluid streaming

    // Live audio level analysis if callback provided
    if (onAudioLevel) {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        this.audioContext = ctx;
        this.analyser = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1.0, avg / 128);
          onAudioLevel(normalized);
          this.animFrameId = requestAnimationFrame(checkLevel);
        };
        this.animFrameId = requestAnimationFrame(checkLevel);
      } catch (err) {
        console.warn("Audio level analyser setup failed:", err);
      }
    }
  }

  /**
   * Stop recording and package the audio buffer
   */
  public async stop(): Promise<RecordingResult | null> {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;

    const recorder = this.mediaRecorder;
    const stream = this.audioStream;
    this.mediaRecorder = null;
    this.audioStream = null;

    if (!recorder || recorder.state === "inactive") {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      return null;
    }

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }

        const durationMs = Date.now() - this.startTime;
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(this.chunks, { type: mime });
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        resolve({
          blob,
          buffer,
          durationMs,
          format: "webm",
        });
      };

      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });
  }
}

export const audioRecorder = new AudioRecorder();
