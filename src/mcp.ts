import { spawn, ChildProcess } from "child_process";
import readline from "readline";

export interface MCPConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

class MCPClient {
  private name: string;
  private config: MCPConfig;
  private process: ChildProcess | null = null;
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();
  private nextRequestId = 1;
  private toolsList: MCPTool[] = [];
  private initialized = false;

  constructor(name: string, config: MCPConfig) {
    this.name = name;
    this.config = config;
  }

  public getTools(): MCPTool[] {
    return this.toolsList;
  }

  public getName(): string {
    return this.name;
  }

  public async start(): Promise<void> {
    const { command, args, env } = this.config;
    console.log(`[MCP] Starting server "${this.name}": ${command} ${args.join(" ")}`);
    
    // On Windows, commands like 'npx' or 'npm' require shell execution
    const isWindows = process.platform === "win32";
    
    this.process = spawn(command, args, {
      env: { ...process.env, ...(env || {}) },
      shell: isWindows, // Use shell on Windows to support npx/global cmds
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stderr?.on("data", (data) => {
      console.warn(`[MCP Server ${this.name} stderr]`, data.toString().trim());
    });

    const reader = readline.createInterface({
      input: this.process.stdout!,
      terminal: false,
    });

    reader.on("line", (line) => {
      try {
        const message = JSON.parse(line);
        if (message.id !== undefined) {
          const pending = this.pendingRequests.get(message.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(message.id);
            if (message.error) {
              pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
            } else {
              pending.resolve(message.result);
            }
          }
        }
      } catch (e) {
        console.error(`[MCP Client ${this.name}] Failed to parse message line:`, line, e);
      }
    });

    this.process.on("close", (code) => {
      console.log(`[MCP Server ${this.name}] process exited with code ${code}`);
      this.process = null;
      this.initialized = false;
    });

    this.process.on("error", (err) => {
      console.error(`[MCP Server ${this.name}] process error:`, err);
    });

    // Run MCP Handshake
    try {
      await this.handshake();
      await this.fetchTools();
      this.initialized = true;
      console.log(`[MCP] Server "${this.name}" initialized successfully. Found ${this.toolsList.length} tools.`);
    } catch (err) {
      console.error(`[MCP] Server "${this.name}" initialization failed:`, err);
      this.kill();
      throw err;
    }
  }

  private sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        return reject(new Error(`MCP Server ${this.name} is not running.`));
      }
      const id = this.nextRequestId++;
      const request = { jsonrpc: "2.0", id, method, params };
      
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP Request ${method} timed out (15s)`));
      }, 15000);

      this.pendingRequests.set(id, { resolve, reject, timeout });
      this.process.stdin!.write(JSON.stringify(request) + "\n");
    });
  }

  private async handshake(): Promise<void> {
    // 1. Initialize
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "Orca-Universal-Proxy", version: "2.1.0" },
    });

    // 2. Send initialized notification (doesn't expect reply)
    if (this.process) {
      const notification = { jsonrpc: "2.0", method: "notifications/initialized" };
      this.process.stdin!.write(JSON.stringify(notification) + "\n");
    }
  }

  private async fetchTools(): Promise<void> {
    const result = await this.sendRequest("tools/list", {});
    this.toolsList = result?.tools || [];
  }

  public async callTool(toolName: string, args: any): Promise<any> {
    return this.sendRequest("tools/call", {
      name: toolName,
      arguments: args,
    });
  }

  public kill(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.initialized = false;
    this.pendingRequests.clear();
  }
}

// Global registry of connected MCP clients
const activeClients = new Map<string, MCPClient>();

export async function initMCPServers(serversConfig: Record<string, MCPConfig>): Promise<void> {
  // Shutdown current active processes
  shutdownMCPServers();

  for (const [name, config] of Object.entries(serversConfig)) {
    try {
      const client = new MCPClient(name, config);
      await client.start();
      activeClients.set(name, client);
    } catch (e) {
      console.error(`[MCP] Failed to start server "${name}":`, e);
    }
  }
}

export function shutdownMCPServers(): void {
  for (const client of activeClients.values()) {
    client.kill();
  }
  activeClients.clear();
  console.log("[MCP] All MCP servers shut down.");
}

export function getAllMCPTools(): (MCPTool & { serverName: string })[] {
  const allTools: (MCPTool & { serverName: string })[] = [];
  for (const [serverName, client] of activeClients.entries()) {
    for (const tool of client.getTools()) {
      allTools.push({ ...tool, serverName });
    }
  }
  return allTools;
}

export async function executeMCPTool(serverName: string, toolName: string, args: any): Promise<any> {
  const client = activeClients.get(serverName);
  if (!client) {
    throw new Error(`MCP Server "${serverName}" is not running.`);
  }
  return client.callTool(toolName, args);
}
