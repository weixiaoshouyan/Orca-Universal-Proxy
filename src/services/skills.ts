import fs from "fs";
import path from "path";
import { spawn } from "child_process";

// ---------------------------------------------------------------------------
// Base directory resolution (replicated from index.ts with adjusted offsets)
// index.ts lives in src/ , this module lives in src/services/
// ---------------------------------------------------------------------------

const _isPkg = !!(process as any).pkg;
const _isSEA = typeof (process as any).isSea !== "undefined" && (process as any).isSea;
const _isElectron = !!process.env.ORCA_BASE_DIR;

/** Project root (equivalent to _devDir in index.ts) */
const projectRoot = path.join(__dirname, "..", "..");

/** src/ directory (equivalent to _portableDir in index.ts) */
const srcDir = path.join(__dirname, "..");

const _BASE_DIR = _isElectron
  ? process.env.ORCA_BASE_DIR!
  : _isPkg || _isSEA
    ? path.dirname(process.execPath)
    : fs.existsSync(path.join(srcDir, "public"))
      ? srcDir
      : projectRoot;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Directory where agent skill folders live */
export const SKILLS_DIR = path.join(_BASE_DIR, "data", "skills");

/**
 * Skills manifest cache (keyed by skill id).
 * Reserved for future population — currently unused.
 */
export const _skillsManifest: Record<string, any> = {};

// ---------------------------------------------------------------------------
// Simple logger (self-contained; the full log() in index.ts has many server
// globals that we don't need to pull in)
// ---------------------------------------------------------------------------

const LOG_LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LOG_LEVEL = process.env.ORCA_LOG_LEVEL || "info";
const currentLevel = LOG_LEVELS[LOG_LEVEL] ?? 1;

function log(level: string, ...args: unknown[]): void {
  if ((LOG_LEVELS[level] ?? 1) < currentLevel) return;
  const ts = new Date().toISOString();
  const message = args
    .map((a) => {
      if (a instanceof Error) return a.stack || String(a);
      return typeof a === "string" ? a : JSON.stringify(a);
    })
    .join(" ");
  console.log(`[${ts}] [${level.toUpperCase()}]`, message);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively copy a directory (synchronous, used during skill bootstrap only).
 */
function copyFolderRecursiveSync(from: string, to: string): void {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const items = fs.readdirSync(from);
  for (const item of items) {
    const srcPath = path.join(from, item);
    const dstPath = path.join(to, item);
    const stat = fs.statSync(srcPath);
    if (stat.isFile()) {
      fs.copyFileSync(srcPath, dstPath);
    } else if (stat.isDirectory()) {
      copyFolderRecursiveSync(srcPath, dstPath);
    }
  }
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Initialise the skills directory.
 * On first run it copies default skills from the source directory
 * (ORCA_SKILLS_SRC_DIR, project skills/ folder, or Electron unpacked path)
 * into SKILLS_DIR when that directory is empty.
 */
export function initSkillsDirectory(): void {
  try {
    let srcSkillsDir =
      process.env.ORCA_SKILLS_SRC_DIR || path.join(projectRoot, "skills");

    if (!fs.existsSync(srcSkillsDir) && _isElectron) {
      const unpackedDir = srcDir.replace("app.asar", "app.asar.unpacked");
      srcSkillsDir = path.join(unpackedDir, "..", "skills");
      if (!fs.existsSync(srcSkillsDir)) {
        srcSkillsDir = path.join(srcDir, "..", "skills");
      }
    }

    log("info", `[Skills] Calculated srcSkillsDir path: ${srcSkillsDir} (Exists: ${fs.existsSync(srcSkillsDir)})`);

    if (!fs.existsSync(SKILLS_DIR)) {
      fs.mkdirSync(SKILLS_DIR, { recursive: true });
    }

    const existing = fs.readdirSync(SKILLS_DIR);
    if (existing.length === 0 && fs.existsSync(srcSkillsDir)) {
      log("info", `[Skills] Copying default skills from ${srcSkillsDir} to ${SKILLS_DIR}`);
      copyFolderRecursiveSync(srcSkillsDir, SKILLS_DIR);
      log("info", "[Skills] Default skills copied successfully.");
    }
  } catch (e) {
    log("error", "Failed to initialize skills directory:", e);
  }
}

/**
 * Parse simple YAML frontmatter at the top of a SKILL.md / Markdown file.
 */
export interface Frontmatter {
  name: string;
  description: string;
  body: string;
}

export function parseFrontmatter(content: string): Frontmatter {
  const result: Frontmatter = { name: "", description: "", body: content };
  if (content.startsWith("---")) {
    const parts = content.split("---");
    if (parts.length >= 3) {
      const yaml = parts[1];
      const lines = yaml.split("\n");
      for (const line of lines) {
        if (line.includes(":")) {
          const idx = line.indexOf(":");
          const k = line.substring(0, idx).trim();
          const v = line.substring(idx + 1).trim();
          if (k === "name") result.name = v.replace(/^['"]|['"]$/g, "");
          if (k === "description") result.description = v.replace(/^['"]|['"]$/g, "");
        }
      }
      result.body = parts.slice(2).join("---").trim();
    }
  }
  return result;
}

/**
 * Return the system-prompt text that informs the LLM about the Skills System.
 */
export function getSkillsSystemPrompt(): string {
  return `\n[Agent Skills System]
You have access to a repository of specialized automation skills (e.g., document automation, scraping, media generation) located at '${SKILLS_DIR}'.
To use these skills:
1. If you need to search for specialized tools/scripts, call \`list_available_skills\` to see the list of skill IDs and descriptions.
2. Call \`get_skill_details\` with a specific skillId to read its detailed instructions, guidelines, and available scripts.
3. Call \`run_skill_script\` to execute a script from that skill with required arguments.
Do NOT try to guess script names or skill details without checking them first via the tools.`;
}

// ---------------------------------------------------------------------------
// Script / command runners
// ---------------------------------------------------------------------------

/** Max buffer per stream before truncation kicks in. */
const MAX_BUFFER = 50 * 1024; // 50 KB

/** Common timeout for spawned children. */
const SCRIPT_TIMEOUT_MS = 120_000; // 120 s

/**
 * Execute a script from within a skill's `scripts/` directory.
 *
 * @param skillId      The skill folder name under SKILLS_DIR.
 * @param scriptName   The script filename, e.g. `run.py` or `fetch.js`.
 * @param args         CLI arguments to pass to the script.
 * @param workspacePath Optional path exposed as WORKSPACE_PATH / PROJECT_DIR env vars.
 */
export function runSkillScript(
  skillId: string,
  scriptName: string,
  args: string[],
  workspacePath?: string
): Promise<string> {
  return new Promise((resolve) => {
    const skillPath = path.join(SKILLS_DIR, skillId);
    const scriptPath = path.join(skillPath, "scripts", scriptName);

    if (!fs.existsSync(scriptPath)) {
      return resolve(`Error: Script not found at ${scriptPath}`);
    }

    const ext = path.extname(scriptName).toLowerCase();
    let cmd = "node";
    const runArgs: string[] = [scriptPath, ...(args || [])];
    if (ext === ".py") {
      cmd = "python";
    }

    const isWindows = process.platform === "win32";

    const child = spawn(cmd, runArgs, {
      shell: isWindows,
      env: {
        ...process.env,
        WORKSPACE_PATH: workspacePath || "",
        PROJECT_DIR: workspacePath || "",
      },
    });

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;

    child.stdout.on("data", (d) => {
      const chunk = d.toString();
      if (stdout.length + chunk.length > MAX_BUFFER) {
        if (!stdoutTruncated) {
          stdout +=
            chunk.substring(0, MAX_BUFFER - stdout.length) +
            "\n[Stdout truncated: exceeded 50KB limit to prevent request overflow...]";
          stdoutTruncated = true;
        }
      } else if (!stdoutTruncated) {
        stdout += chunk;
      }
    });

    child.stderr.on("data", (d) => {
      const chunk = d.toString();
      if (stderr.length + chunk.length > MAX_BUFFER) {
        if (!stderrTruncated) {
          stderr +=
            chunk.substring(0, MAX_BUFFER - stderr.length) +
            "\n[Stderr truncated: exceeded 50KB limit to prevent request overflow...]";
          stderrTruncated = true;
        }
      } else if (!stderrTruncated) {
        stderr += chunk;
      }
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve(
        `[Script Timeout after 120s]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`
      );
    }, SCRIPT_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timeout);
      const output = `[Exit Code ${code}]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`;
      if (output.length > MAX_BUFFER * 2) {
        resolve(
          output.substring(0, MAX_BUFFER * 2) +
            "\n\n[Output truncated to prevent request overflow]"
        );
      } else {
        resolve(output);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve(`[Execution Error]:\n${err.message}`);
    });
  });
}

/**
 * Execute an arbitrary terminal command inside the given workspace.
 *
 * Uses bash on Linux/macOS and PowerShell on Windows.
 */
export function executeTerminalCommand(
  command: string,
  workspacePath: string
): Promise<string> {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows ? "powershell" : "bash";
    const runArgs: string[] = isWindows
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command]
      : ["-c", command];

    const child = spawn(cmd, runArgs, {
      cwd: workspacePath,
      shell: isWindows,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;

    child.stdout.on("data", (d) => {
      const chunk = d.toString();
      if (stdout.length + chunk.length > MAX_BUFFER) {
        if (!stdoutTruncated) {
          stdout +=
            chunk.substring(0, MAX_BUFFER - stdout.length) +
            "\n[Stdout truncated: exceeded 50KB limit to prevent request overflow...]";
          stdoutTruncated = true;
        }
      } else if (!stdoutTruncated) {
        stdout += chunk;
      }
    });

    child.stderr.on("data", (d) => {
      const chunk = d.toString();
      if (stderr.length + chunk.length > MAX_BUFFER) {
        if (!stderrTruncated) {
          stderr +=
            chunk.substring(0, MAX_BUFFER - stderr.length) +
            "\n[Stderr truncated: exceeded 50KB limit to prevent request overflow...]";
          stderrTruncated = true;
        }
      } else if (!stderrTruncated) {
        stderr += chunk;
      }
    });

    const timeout = setTimeout(() => {
      child.kill();
      resolve(
        `[Command Timeout after 120s]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`
      );
    }, SCRIPT_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timeout);
      const output = `[Exit Code ${code}]\n[Stdout]:\n${stdout}\n[Stderr]:\n${stderr}`;
      if (output.length > MAX_BUFFER * 2) {
        resolve(
          output.substring(0, MAX_BUFFER * 2) +
            "\n\n[Output truncated to prevent request overflow]"
        );
      } else {
        resolve(output);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolve(`[Execution Error]:\n${err.message}`);
    });
  });
}
