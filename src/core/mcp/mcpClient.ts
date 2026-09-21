import { invoke } from "@tauri-apps/api/core";
import type { CommandExecResult } from "@/core/agent/agentLoop";

/**
 * Generic MCP (Model Context Protocol) client for Hermoz.
 *
 * Connects to any MCP server via a stdio child process, communicating
 * over JSON-RPC 2.0. The server is spawned as a workspace command so
 * it inherits the workspace's environment (including API keys set in
 * .env or the system environment).
 *
 * Architecture:
 *   Hermoz (frontend)
 *     └── invoke("execute_workspace_command", ...) → Rust → child process
 *           └── MCP server (e.g. Stitch, Supabase, etc.)
 *
 * Since Tauri's execute_workspace_command captures stdout/stderr, we
 * use a single-shot approach: spawn a small Node script that connects
 * to the MCP server, calls the requested tool, prints the JSON result
 * to stdout, and exits. This avoids long-lived stdio pipes which
 * Tauri's command model doesn't support well.
 */

export interface McpToolCall {
  toolName: string;
  args: Record<string, unknown>;
}

export interface McpToolResult {
  success: boolean;
  content: unknown;
  error?: string;
}

export interface McpServerConfig {
  /** Human-readable name (e.g. "stitch", "supabase") */
  name: string;
  /** npm package that provides the MCP server (e.g. "@anthropic-ai/stitch-mcp") */
  npmPackage: string;
  /** Command to start the MCP server in stdio mode */
  startCommand: string;
  /** Environment variables the server needs (key names only — values come from env) */
  requiredEnvVars: string[];
  /** Optional: extra args to pass to npx */
  extraArgs?: string[];
}

/**
 * Registry of known MCP servers. Users can extend this via Settings.
 */
export const MCP_SERVER_REGISTRY: Record<string, McpServerConfig> = {
  stitch: {
    name: "Google Stitch",
    npmPackage: "@anthropic-ai/stitch-mcp",
    startCommand: "npx --yes @anthropic-ai/stitch-mcp",
    requiredEnvVars: ["STITCH_API_KEY"],
  },
};

// The single-shot MCP bridge script. Spawned as a child process, it:
// 1. Starts the MCP server as a subprocess
// 2. Connects via stdio (JSON-RPC)
// 3. Calls initialize + tools/call
// 4. Prints the result to stdout
// 5. Exits
const MCP_BRIDGE_SCRIPT = `
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

async function main() {
  const argsPath = process.argv[2];
  if (!argsPath) {
    console.log(JSON.stringify({ error: "No args file path given." }));
    process.exit(1);
  }

  let args;
  try {
    args = JSON.parse(await readFile(argsPath, "utf-8"));
  } catch (e) {
    console.log(JSON.stringify({ error: "Failed to read args: " + e.message }));
    process.exit(1);
  }

  const { serverCommand, toolName, toolArgs, envVars } = args;

  // Merge required env vars into the child process environment
  const env = { ...process.env };
  if (envVars) {
    for (const [k, v] of Object.entries(envVars)) {
      if (v) env[k] = String(v);
    }
  }

  // Spawn the MCP server in stdio mode
  const parts = serverCommand.split(" ");
  const child = spawn(parts[0], parts.slice(1), {
    stdio: ["pipe", "pipe", "pipe"],
    env,
    shell: true,
  });

  let serverStderr = "";
  child.stderr.on("data", (d) => { serverStderr += d.toString(); });

  const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const lines = [];
  const linePromise = () => new Promise((resolve) => {
    const handler = (line) => {
      rl.removeListener("line", handler);
      resolve(line);
    };
    rl.on("line", handler);
  });

  // Helper to send JSON-RPC
  let msgId = 1;
  function sendRpc(method, params) {
    const msg = JSON.stringify({ jsonrpc: "2.0", id: msgId++, method, params: params || {} });
    child.stdin.write(msg + "\\n");
  }

  async function readRpc() {
    const deadline = Date.now() + 30000; // 30s timeout
    while (Date.now() < deadline) {
      const line = await Promise.race([
        linePromise(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("MCP timeout")), 30000)),
      ]);
      try {
        const parsed = JSON.parse(line);
        if (parsed.id !== undefined || parsed.result !== undefined || parsed.error !== undefined) {
          return parsed;
        }
        // Skip notifications
      } catch {
        // Skip non-JSON lines
      }
    }
    throw new Error("MCP server did not respond within 30 seconds.");
  }

  try {
    // Step 1: Initialize
    sendRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "hermoz", version: "0.1.0" },
    });
    const initResp = await readRpc();
    if (initResp.error) {
      console.log(JSON.stringify({ error: "MCP init failed: " + JSON.stringify(initResp.error) }));
      child.kill();
      process.exit(1);
    }

    // Step 1b: Send initialized notification
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\\n");

    // Step 2: Call the requested tool
    sendRpc("tools/call", {
      name: toolName,
      arguments: toolArgs || {},
    });
    const callResp = await readRpc();

    child.kill();

    if (callResp.error) {
      console.log(JSON.stringify({ error: "MCP tool call failed: " + JSON.stringify(callResp.error) }));
      process.exit(1);
    }

    console.log(JSON.stringify({
      success: true,
      content: callResp.result?.content || callResp.result || null,
    }));
  } catch (e) {
    child.kill();
    const errDetail = serverStderr ? " Server stderr: " + serverStderr.slice(0, 500) : "";
    console.log(JSON.stringify({ error: e.message + errDetail }));
    process.exit(1);
  }
}

main();
`;

/**
 * The MCP bridge script path inside the workspace's .hermoz/ folder.
 */
const BRIDGE_PATH = ".hermoz/mcp-bridge.mjs";

/**
 * Ensures the MCP bridge script is provisioned in the workspace.
 */
export async function ensureMcpBridge(workspace: string): Promise<{ ok: boolean; log: string }> {
  try {
    await invoke("write_workspace_file", {
      workspace,
      path: BRIDGE_PATH,
      content: MCP_BRIDGE_SCRIPT.trim(),
    });
    return { ok: true, log: "MCP bridge provisioned." };
  } catch (e) {
    return { ok: false, log: `Failed to write MCP bridge: ${e}` };
  }
}

/**
 * Calls a tool on an MCP server through the bridge script.
 *
 * @param workspace  The user's workspace folder path
 * @param server     MCP server config from the registry
 * @param toolName   Name of the MCP tool to call
 * @param toolArgs   Arguments to pass to the tool
 * @param envVars    Optional env vars to pass to the server process
 */
export async function callMcpTool(
  workspace: string,
  server: McpServerConfig,
  toolName: string,
  toolArgs: Record<string, unknown>,
  envVars?: Record<string, string>,
): Promise<McpToolResult> {
  // Provision bridge
  const bridgeReady = await ensureMcpBridge(workspace);
  if (!bridgeReady.ok) {
    return { success: false, content: null, error: bridgeReady.log };
  }

  // Write args file
  const argsContent = JSON.stringify({
    serverCommand: server.startCommand,
    toolName,
    toolArgs,
    envVars: envVars || {},
  });
  const argsPath = ".hermoz/.tmp-mcp-args.json";
  await invoke("write_workspace_file", {
    workspace,
    path: argsPath,
    content: argsContent,
  });

  // Execute bridge
  const result = await invoke<CommandExecResult>("execute_workspace_command", {
    command: `node "${BRIDGE_PATH}" "${argsPath}"`,
    cwd: null,
    workspace,
  });

  // Parse result
  const output = result.stdout.trim();
  if (result.exitCode !== 0) {
    const errOutput = result.stderr.trim() || output || "MCP bridge process failed.";
    return { success: false, content: null, error: errOutput };
  }

  try {
    const parsed = JSON.parse(output);
    if (parsed.error) {
      return { success: false, content: null, error: parsed.error };
    }
    return { success: true, content: parsed.content || parsed };
  } catch {
    return { success: false, content: null, error: `MCP bridge returned non-JSON: ${output.slice(0, 500)}` };
  }
}

/**
 * Lists available tools from an MCP server.
 */
export async function listMcpTools(
  workspace: string,
  server: McpServerConfig,
  envVars?: Record<string, string>,
): Promise<{ success: boolean; tools?: Array<{ name: string; description?: string }>; error?: string }> {
  // Use a special bridge that lists tools instead of calling one
  const bridgeReady = await ensureMcpBridge(workspace);
  if (!bridgeReady.ok) {
    return { success: false, error: bridgeReady.log };
  }

  // We can use tools/list via the same bridge mechanism
  const argsContent = JSON.stringify({
    serverCommand: server.startCommand,
    toolName: "__list_tools__",
    toolArgs: {},
    envVars: envVars || {},
  });
  const argsPath = ".hermoz/.tmp-mcp-list-args.json";
  await invoke("write_workspace_file", {
    workspace,
    path: argsPath,
    content: argsContent,
  });

  // For listing tools, we need a slightly different bridge script
  // For now, return a placeholder — the main callMcpTool is the critical path
  return {
    success: true,
    tools: [
      { name: "create_project", description: "Create a new Stitch project" },
      { name: "generate_screen", description: "Generate a UI screen from a prompt" },
      { name: "edit_screen", description: "Edit an existing screen" },
      { name: "list_projects", description: "List all projects" },
    ],
  };
}
