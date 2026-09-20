/**
 * Proactive Initiative & Loneliness Prevention Engine
 * Periodically triggers friendly conversational check-ins, playful banter,
 * and Gen-Z humor so the user never feels alone at their desk.
 */

export interface ProactiveEvent {
  message: string;
  emotion: string;
  timestamp: number;
}

type ProactiveCallback = (event: ProactiveEvent) => void;

const PROACTIVE_CHECKINS = [
  { message: "Yo bro, you locked in today or what? Been pretty quiet over there.", emotion: "smug" },
  { message: "Vibe check: how's the project going? Still alive or are we cooked?", emotion: "happy" },
  { message: "Nah fr, don't tell me you forgot to commit your changes again lmao.", emotion: "teasing" },
  { message: "Take a sip of water dude, you've been grinding hard.", emotion: "concerned" },
  { message: "Wait... did you fix that bug or just comment it out? Be honest.", emotion: "thinking" },
  { message: "Just checking in on my favorite dev. What are we building right now?", emotion: "excited" },
  { message: "Bro, staring into space won't write the code for you... or will it?", emotion: "teasing" },
  { message: "No cap, you're doing great today. Let's finish strong.", emotion: "happy" },
];

export class ProactiveEngine {
  private static instance: ProactiveEngine | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private callback: ProactiveCallback | null = null;
  private enabled: boolean = true;
  private intervalMinutes: number = 4;
  private lastTriggerTime: number = Date.now();

  public static getInstance(): ProactiveEngine {
    if (!ProactiveEngine.instance) {
      ProactiveEngine.instance = new ProactiveEngine();
    }
    return ProactiveEngine.instance;
  }

  public init(callback: ProactiveCallback): void {
    this.callback = callback;
    this.start();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    } else {
      this.start();
    }
  }

  public setIntervalMinutes(mins: number): void {
    this.intervalMinutes = Math.max(1, Math.min(30, mins));
    this.start();
  }

  public start(): void {
    this.stop();
    if (!this.enabled) return;

    this.intervalTimer = setInterval(() => {
      this.checkAndTrigger();
    }, this.intervalMinutes * 60 * 1000);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public recordActivity(): void {
    this.lastTriggerTime = Date.now();
  }

  private checkAndTrigger(): void {
    if (!this.enabled || !this.callback) return;

    // Pick random proactive check-in
    const pick = PROACTIVE_CHECKINS[Math.floor(Math.random() * PROACTIVE_CHECKINS.length)];
    this.lastTriggerTime = Date.now();
    this.callback({
      message: pick.message,
      emotion: pick.emotion,
      timestamp: Date.now(),
    });
  }
}

export const proactiveEngine = ProactiveEngine.getInstance();
