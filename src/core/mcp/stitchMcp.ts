import { invoke } from "@tauri-apps/api/core";
import { callMcpTool, MCP_SERVER_REGISTRY, type McpServerConfig, type McpToolResult } from "./mcpClient";

/**
 * Stitch MCP integration for Hermoz Studio.
 *
 * Wraps the generic MCP client with Stitch-specific tool calls:
 *  - create_project: Create a new Stitch design project
 *  - generate_screen: Generate a UI screen from a natural-language prompt
 *  - edit_screen: Edit an existing screen
 *
 * The MCP server used is `@anthropic-ai/stitch-mcp` (or whatever the
 * real package name turns out to be — update MCP_SERVER_REGISTRY).
 *
 * Required environment variable: STITCH_API_KEY
 */

/**
 * Get or create the Stitch MCP server config.
 * Users can override this through Settings → MCP Servers.
 */
export function getStitchConfig(): McpServerConfig {
  return MCP_SERVER_REGISTRY.stitch || {
    name: "Google Stitch",
    npmPackage: "@anthropic-ai/stitch-mcp",
    startCommand: "npx --yes @anthropic-ai/stitch-mcp",
    requiredEnvVars: ["STITCH_API_KEY"],
  };
}

export interface StitchGenerateResult {
  html: string;
  projectId?: string;
  screenId?: string;
}

/**
 * Check if Stitch is configured and ready to use.
 */
export async function checkStitchReady(workspace: string): Promise<{
  ready: boolean;
  reason?: string;
}> {
  // Check if STITCH_API_KEY is set by trying to read it from env
  // We can't directly access env vars from the frontend, so we
  // check via a quick command
  try {
    const result = await invoke<{ stdout: string; stderr: string; exitCode: number }>(
      "execute_workspace_command",
      {
        command:
          typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
            ? "echo %STITCH_API_KEY%"
            : "echo $STITCH_API_KEY",
        cwd: null,
        workspace,
      },
    );
    const val = result.stdout.trim();
    if (!val || val === "%STITCH_API_KEY%" || val === "$STITCH_API_KEY" || val === "undefined") {
      return {
        ready: false,
        reason:
          "STITCH_API_KEY is not set. To connect Stitch:\n" +
          "1. Get an API key from design.google/stitch\n" +
          "2. Set it as an environment variable:\n" +
          "   - Windows: setx STITCH_API_KEY \"your-key-here\"\n" +
          "   - Mac/Linux: export STITCH_API_KEY=\"your-key-here\"\n" +
          "3. Restart Hermoz after setting the key.",
      };
    }
    return { ready: true };
  } catch {
    return {
      ready: false,
      reason: "Could not check STITCH_API_KEY. Make sure a workspace folder is set in Settings.",
    };
  }
}

/**
 * Generate a UI screen via Stitch MCP.
 *
 * @param workspace  The user's workspace folder
 * @param prompt     Natural-language description of the UI to generate
 * @param projectId  Optional project ID (defaults to "hermoz-workspace")
 * @param envOverrides  Optional env var overrides (e.g. { STITCH_API_KEY: "..." })
 */
export async function generateWithStitch(
  workspace: string,
  prompt: string,
  projectId: string = "hermoz-workspace",
  envOverrides?: Record<string, string>,
): Promise<StitchGenerateResult & { error?: string }> {
  const config = getStitchConfig();

  // Call the generate_screen tool via MCP
  const result = await callMcpTool(
    workspace,
    config,
    "generate_screen",
    {
      prompt,
      projectId,
    },
    envOverrides,
  );

  if (!result.success) {
    return {
      html: "",
      error: result.error || "Stitch MCP call failed with no error message.",
    };
  }

  // Parse the MCP response content
  // MCP tool results come as an array of content blocks
  const content = result.content;
  let html = "";
  let screenId: string | undefined;

  if (Array.isArray(content)) {
    // MCP content blocks: [{ type: "text", text: "..." }, ...]
    for (const block of content) {
      if (block && typeof block === "object" && "text" in block) {
        const text = (block as { text: string }).text;
        // Check if it's HTML
        if (text.includes("<") && text.includes(">")) {
          html = text;
        } else {
          // Try parsing as JSON that might contain HTML
          try {
            const parsed = JSON.parse(text);
            if (parsed.html) html = parsed.html;
            if (parsed.screenId) screenId = parsed.screenId;
            if (parsed.projectId) projectId = parsed.projectId;
          } catch {
            // It's just text, might be the HTML itself
            if (text.trim().startsWith("<!") || text.trim().startsWith("<html") || text.trim().startsWith("<div")) {
              html = text;
            }
          }
        }
      }
    }
  } else if (content && typeof content === "object") {
    // Direct object response
    const obj = content as Record<string, unknown>;
    if (obj.html) html = String(obj.html);
    if (obj.screenId) screenId = String(obj.screenId);
  } else if (typeof content === "string") {
    html = content;
  }

  if (!html) {
    return {
      html: "",
      error: `Stitch returned content but no HTML was found. Raw content: ${JSON.stringify(content).slice(0, 500)}`,
    };
  }

  return { html, projectId, screenId };
}

/**
 * Edit an existing screen via Stitch MCP.
 */
export async function editWithStitch(
  workspace: string,
  prompt: string,
  screenId: string,
  projectId: string = "hermoz-workspace",
  envOverrides?: Record<string, string>,
): Promise<StitchGenerateResult & { error?: string }> {
  const config = getStitchConfig();

  const result = await callMcpTool(
    workspace,
    config,
    "edit_screen",
    {
      prompt,
      screenId,
      projectId,
    },
    envOverrides,
  );

  if (!result.success) {
    return {
      html: "",
      error: result.error || "Stitch MCP edit call failed.",
    };
  }

  // Parse response same as generate
  const content = result.content;
  let html = "";

  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && "text" in block) {
        const text = (block as { text: string }).text;
        if (text.includes("<") && text.includes(">")) {
          html = text;
        } else {
          try {
            const parsed = JSON.parse(text);
            if (parsed.html) html = parsed.html;
          } catch {
            if (text.trim().startsWith("<!") || text.trim().startsWith("<html") || text.trim().startsWith("<div")) {
              html = text;
            }
          }
        }
      }
    }
  } else if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (obj.html) html = String(obj.html);
  } else if (typeof content === "string") {
    html = content;
  }

  if (!html) {
    return { html: "", error: "Stitch edit returned no HTML." };
  }

  return { html, projectId, screenId };
}
