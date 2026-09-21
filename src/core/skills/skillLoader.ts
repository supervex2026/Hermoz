import { invoke } from "@tauri-apps/api/core";

/**
 * Hermoz Skills — a lightweight, Claude Code-compatible skill loader.
 *
 * A "skill" here is exactly the same shape Claude Code / Antigravity / Codex
 * use: a folder containing a SKILL.md with instructions. Hermoz doesn't
 * reimplement those ecosystems — when the user names an exact skill or
 * plugin, the `install_skill` action (see agentLoop.ts) shells out to the
 * real tool (the `claude` CLI's plugin installer, or a `git clone` of a
 * given source) to fetch it, then this module registers the resulting
 * SKILL.md so future turns that mention that skill by name get its
 * instructions injected into the request context automatically.
 */

export interface InstalledSkill {
  /** Exact name the user referred to it by. */
  name: string;
  /** Workspace-relative folder containing this skill's SKILL.md. */
  path: string;
  /** First line of the SKILL.md, if any, for display purposes. */
  description?: string;
  installedAt: number;
}

const REGISTRY_PATH = ".hermoz/skills/registry.json";
const MAX_INJECTED_SKILLS = 3;
const MAX_SKILL_CHARS = 6000;

let cache: InstalledSkill[] = [];

async function readRegistry(workspace: string): Promise<InstalledSkill[]> {
  try {
    const raw = await invoke<string>("read_workspace_file", {
      workspace,
      path: REGISTRY_PATH,
    });
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as InstalledSkill[]) : [];
  } catch {
    return [];
  }
}

async function writeRegistry(workspace: string, skills: InstalledSkill[]): Promise<void> {
  await invoke("write_workspace_file", {
    workspace,
    path: REGISTRY_PATH,
    content: JSON.stringify(skills, null, 2),
  });
}

/** Reloads the in-memory skill cache from disk. Call on app start / workspace change. */
export async function refreshSkillRegistry(workspace?: string): Promise<void> {
  cache = workspace ? await readRegistry(workspace) : [];
}

export function getInstalledSkills(): InstalledSkill[] {
  return cache;
}

/**
 * Records a newly installed skill (or updates it, if reinstalled) and
 * refreshes the cache. Safe to call even if the SKILL.md couldn't be found —
 * callers should only register when a SKILL.md was actually located.
 */
export async function registerSkill(
  workspace: string,
  skill: Omit<InstalledSkill, "installedAt">,
): Promise<void> {
  const existing = await readRegistry(workspace);
  const next = [
    ...existing.filter((s) => s.name.toLowerCase() !== skill.name.toLowerCase()),
    { ...skill, installedAt: Date.now() },
  ];
  await writeRegistry(workspace, next);
  cache = next;
}

/**
 * Scans installed skills for any whose exact name appears in `message`
 * (case-insensitive substring match), and returns their SKILL.md content
 * concatenated for injection into the AI request context. Returns
 * `undefined` when nothing matches, so callers can omit the field entirely.
 */
export async function getLoadedSkillInstructions(
  workspace: string | undefined,
  message: string,
): Promise<string | undefined> {
  if (!workspace || cache.length === 0 || !message.trim()) return undefined;

  const lower = message.toLowerCase();
  const matches = cache.filter((s) => s.name && lower.includes(s.name.toLowerCase()));
  if (matches.length === 0) return undefined;

  const sections: string[] = [];
  for (const skill of matches.slice(0, MAX_INJECTED_SKILLS)) {
    try {
      const content = await invoke<string>("read_workspace_file", {
        workspace,
        path: `${skill.path}/SKILL.md`,
      });
      sections.push(`### Skill: ${skill.name}\n${content.slice(0, MAX_SKILL_CHARS)}`);
    } catch {
      // Registered but unreadable (moved/deleted on disk) — skip silently.
    }
  }
  return sections.length > 0 ? sections.join("\n\n") : undefined;
}
