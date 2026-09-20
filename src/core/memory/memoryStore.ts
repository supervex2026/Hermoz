/**
 * Long-Term Memory Vault for Momo
 * Stores persistent facts, user projects, preferences, and inside jokes across sessions.
 * Never belongs to an AI provider - Momo owns this state.
 */

import { invoke } from "@tauri-apps/api/core";
import type { MemoryCategory, MemoryItem } from "@/types";
export type { MemoryCategory, MemoryItem };

const STORAGE_KEY = "momo_long_term_memories";

const INITIAL_MEMORIES: MemoryItem[] = [
  {
    id: "init-1",
    category: "USER_PROFILE",
    content: "User is an ambitious creator & developer building desktop apps, games, and media.",
    createdAt: Date.now() - 100000,
    importance: "high",
  },
  {
    id: "init-2",
    category: "PROJECT",
    content: "Project: Momo — an AI desktop companion living on the screen with personality, voice, and vision.",
    createdAt: Date.now() - 80000,
    importance: "high",
  },
  {
    id: "init-3",
    category: "PREFERENCE",
    content: "Prefers casual bro talk, witty banter, and playful roasts over corporate robotic assistant replies.",
    createdAt: Date.now() - 60000,
    importance: "high",
  },
];

export class MemoryStore {
  private static instance: MemoryStore | null = null;
  private memories: MemoryItem[] = [];
  private activeProject: string | null = null;
  private currentTask: string | null = null;
  private userProfile: string = "Ambitious developer & creator";

  private constructor() {
    this.load();
  }

  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  public getMemories(): MemoryItem[] {
    return [...this.memories];
  }

  public getByCategory(category: MemoryCategory): MemoryItem[] {
    return this.memories.filter((m) => m.category === category);
  }

  public getActiveProject(): string | null {
    return this.activeProject;
  }

  public setActiveProject(proj: string | null): void {
    this.activeProject = proj;
    this.save();
  }

  public getCurrentTask(): string | null {
    return this.currentTask;
  }

  public setCurrentTask(task: string | null): void {
    this.currentTask = task;
    this.save();
  }

  public addMemory(
    category: MemoryCategory,
    content: string,
    importance: "high" | "normal" | "low" = "normal",
  ): MemoryItem {
    const trimmed = content.trim();
    // Deduplicate: check if very similar memory already exists
    const existing = this.memories.find(
      (m) => m.content.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      existing.importance = importance;
      this.save();
      return existing;
    }

    const item: MemoryItem = {
      id: crypto.randomUUID(),
      category,
      content: trimmed,
      createdAt: Date.now(),
      importance,
    };
    this.memories.unshift(item);
    this.save();
    return item;
  }

  public updateMemory(id: string, content: string): void {
    const item = this.memories.find((m) => m.id === id);
    if (item) {
      item.content = content.trim();
      this.save();
    }
  }

  public deleteMemory(id: string): void {
    this.memories = this.memories.filter((m) => m.id !== id);
    this.save();
  }

  public clearAll(): void {
    this.memories = [];
    this.save();
  }

  /**
   * Deterministically extract memory candidates from user interaction
   * without hallucinating facts.
   */
  public extractMemoryCandidates(userMessage: string): void {
    const text = userMessage.trim();
    const lower = text.toLowerCase();

    // 1. Project detection
    const projMatch = text.match(
      /(?:working on|building|creating|making)\s+(?:a|an|my)?\s*(?:game|project|app|trailer|film|video|tool)?\s*(?:called|named)\s+([A-Za-z0-9_\-\s]{2,24})/i,
    );
    if (projMatch && projMatch[1]) {
      const projName = projMatch[1].trim();
      this.activeProject = projName;
      this.addMemory("PROJECT", `User is building a project called ${projName}`, "high");
    }

    // 2. Preferences
    if (lower.includes("i prefer ") || lower.includes("i like ") || lower.includes("i love ") || lower.includes("i hate ")) {
      const prefMatch = text.match(/i\s+(?:prefer|like|love|hate)\s+([^.!?\n]{4,60})/i);
      if (prefMatch && prefMatch[1]) {
        this.addMemory("PREFERENCE", `User preference: ${prefMatch[0].trim()}`, "normal");
      }
    }

    // 3. Project Goals
    if (lower.includes("want to finish") || lower.includes("deadline") || lower.includes("goal is to")) {
      const goalMatch = text.match(/(?:want to finish|goal is to|deadline is)\s+([^.!?\n]{4,60})/i);
      if (goalMatch) {
        this.addMemory("PROJECT_GOAL", `Goal: ${goalMatch[0].trim()}`, "high");
      }
    }

    // 4. Current Tasks
    if (lower.includes("right now i'm ") || lower.includes("currently working on ")) {
      const taskMatch = text.match(/(?:right now i'm|currently working on)\s+([^.!?\n]{4,60})/i);
      if (taskMatch && taskMatch[1]) {
        this.currentTask = taskMatch[1].trim();
        this.addMemory("CURRENT_TASK", `Active task: ${taskMatch[1].trim()}`, "normal");
      }
    }
  }

  /**
   * Context Builder: Retrieves only the most relevant memories for the current turn.
   */
  public getRelevantMemories(query: string, maxItems: number = 6): string[] {
    if (this.memories.length === 0) return [];

    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Score memories based on keyword overlap + importance
    const scored = this.memories.map((m) => {
      let score = 0;
      if (m.importance === "high") score += 2;
      const lower = m.content.toLowerCase();
      for (const w of words) {
        if (lower.includes(w)) score += 3;
      }
      // Project / Task boost if words match active project
      if (this.activeProject && lower.includes(this.activeProject.toLowerCase())) {
        score += 2;
      }
      return { memory: m, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored
      .slice(0, maxItems)
      .map((s) => `[${s.memory.category}] ${s.memory.content}`);
  }

  private async load(): Promise<void> {
    try {
      // Try loading from canonical state in Rust backend
      const state = await invoke<{
        memories?: Array<{ id: string; category: string; content: string; importance: string; createdAt: number }>;
        activeProject?: string;
        currentTask?: string;
        userProfile?: string;
      }>("get_canonical_state");

      if (state && Array.isArray(state.memories) && state.memories.length > 0) {
        this.memories = state.memories as MemoryItem[];
        this.activeProject = state.activeProject || null;
        this.currentTask = state.currentTask || null;
        if (state.userProfile) this.userProfile = state.userProfile;
        return;
      }
    } catch {
      // Outside Tauri or first run
    }

    if (typeof localStorage !== "undefined") {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          this.memories = JSON.parse(local);
          return;
        }
      } catch {
        /* ignore */
      }
    }

    this.memories = INITIAL_MEMORIES;
    this.save();
  }

  private async save(): Promise<void> {
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories));
      } catch {
        /* ignore */
      }
    }

    try {
      await invoke("update_canonical_state", {
        state: {
          memories: this.memories,
          activeProject: this.activeProject,
          currentTask: this.currentTask,
          userProfile: this.userProfile,
        },
      });
    } catch {
      // Outside Tauri preview mode
    }
  }
}

export const memoryStore = MemoryStore.getInstance();
