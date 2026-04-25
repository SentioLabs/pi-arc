import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StringEnum } from "@mariozechner/pi-ai";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateTail, type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

type ArcCommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

const WORKFLOW_SKILLS: Array<{ command: string; skill: string; description: string }> = [
  {
    command: "arc-brainstorm",
    skill: "arc-brainstorm",
    description: "Use arc-brainstorm for design discovery and trade-off analysis",
  },
  {
    command: "arc-plan",
    skill: "arc-plan",
    description: "Use arc-plan to break an approved design into arc implementation tasks",
  },
  {
    command: "arc-build",
    skill: "arc-build",
    description: "Use arc-build to orchestrate implementation of arc tasks",
  },
  {
    command: "arc-debug",
    skill: "arc-debug",
    description: "Use arc-debug for structured root-cause investigation",
  },
  {
    command: "arc-review",
    skill: "arc-review",
    description: "Use arc-review to review changes against an arc task",
  },
  {
    command: "arc-verify",
    skill: "arc-verify",
    description: "Use arc-verify for evidence-based completion checks",
  },
  {
    command: "arc-finish",
    skill: "arc-finish",
    description: "Use arc-finish to wrap up a session and persist handoff context",
  },
  {
    command: "arc-team-dispatch",
    skill: "arc-team-dispatch",
    description: "Use arc-team-dispatch to coordinate team-style work from arc issues",
  },
];

function outputOf(result: ArcCommandResult): string {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  if (stdout && stderr) return `${stdout}\n\nstderr:\n${stderr}`;
  return stdout || stderr || `(exit code ${result.code ?? "unknown"}, no output)`;
}

type ArcAgentName = "builder" | "code-reviewer" | "doc-writer" | "evaluator" | "issue-manager" | "spec-reviewer";

const ARC_AGENT_NAMES = [
  "builder",
  "code-reviewer",
  "doc-writer",
  "evaluator",
  "issue-manager",
  "spec-reviewer",
] as const;

const EXTENSION_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(EXTENSION_DIR, "..");
const AGENTS_DIR = path.join(PACKAGE_ROOT, "agents");

function parseAgentMarkdown(markdown: string): { prompt: string; model?: string; tools?: string[] } {
  if (!markdown.startsWith("---")) return { prompt: markdown.trim() };
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) return { prompt: markdown.trim() };

  const frontmatter = markdown.slice(3, end).trim().split(/\r?\n/);
  const body = markdown.slice(end + "\n---".length).trim();
  let model: string | undefined;
  const tools: string[] = [];
  let inTools = false;

  for (const line of frontmatter) {
    const trimmed = line.trim();
    if (trimmed.startsWith("model:")) {
      model = trimmed.slice("model:".length).trim().replace(/^['\"]|['\"]$/g, "");
      inTools = false;
      continue;
    }
    if (trimmed.startsWith("tools:")) {
      inTools = true;
      const inline = trimmed.slice("tools:".length).trim();
      if (inline) tools.push(...inline.split(",").map((tool) => tool.trim()).filter(Boolean));
      continue;
    }
    if (inTools && trimmed.startsWith("-")) {
      tools.push(trimmed.slice(1).trim());
      continue;
    }
    if (trimmed && !trimmed.startsWith("#")) inTools = false;
  }

  return { prompt: body, model, tools: tools.length > 0 ? tools : undefined };
}

function modelPattern(model?: string): string | undefined {
  if (!model) return undefined;
  const normalized = model.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "haiku") return "haiku";
  if (normalized === "sonnet") return "sonnet";
  if (normalized === "opus") return "opus";
  return model;
}

function runPiSubprocess(args: string[], cwd: string, signal?: AbortSignal): Promise<ArcCommandResult> {
  return new Promise((resolve) => {
    const child = spawn("pi", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: ArcCommandResult) => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener("abort", abort);
      resolve(result);
    };

    const abort = () => child.kill("SIGTERM");
    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => finish({ code: 127, stdout, stderr: stderr + error.message }));
    child.on("close", (code) => finish({ code, stdout, stderr }));
  });
}

function truncatedOutput(text: string): string {
  const truncation = truncateTail(text, { maxBytes: DEFAULT_MAX_BYTES, maxLines: DEFAULT_MAX_LINES });
  if (!truncation.truncated) return truncation.content;
  return `${truncation.content}\n\n[Output truncated: ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(
    truncation.outputBytes,
  )} of ${formatSize(truncation.totalBytes)}).]`;
}

function runArcWithStdin(
  args: string[],
  stdin: unknown,
  cwd: string,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<ArcCommandResult> {
  return new Promise((resolve) => {
    const child = spawn("arc", args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: ArcCommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", abort);
      resolve(result);
    };

    const abort = () => {
      child.kill("SIGTERM");
    };

    const timeout = setTimeout(() => {
      stderr += `Timed out after ${timeoutMs}ms`;
      child.kill("SIGTERM");
    }, timeoutMs);

    if (signal) {
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.stdin.on("error", (error) => {
      stderr += error.message;
    });
    child.on("error", (error) => {
      finish({ code: 127, stdout, stderr: stderr + error.message });
    });
    child.on("close", (code) => {
      finish({ code, stdout, stderr });
    });

    child.stdin.end(`${JSON.stringify(stdin)}\n`);
  });
}

export default function arcExtension(pi: ExtensionAPI) {
  let primeCache = "";
  let primeError = "";
  let lastPrimeAt = 0;

  async function runArc(args: string[], ctx: ExtensionContext, timeout = 15_000): Promise<ArcCommandResult> {
    const result = await pi.exec("arc", args, { timeout, signal: ctx.signal });
    return {
      code: result.code,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  }

  async function refreshPrime(ctx: ExtensionContext): Promise<boolean> {
    try {
      const result = await runArc(["prime"], ctx, 20_000);
      lastPrimeAt = Date.now();
      if (result.code === 0) {
        primeCache = result.stdout.trim();
        primeError = "";
        return true;
      }
      primeError = outputOf(result);
      return false;
    } catch (error) {
      lastPrimeAt = Date.now();
      primeError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function sendArcMessage(title: string, body: string) {
    pi.sendMessage({
      customType: "arc",
      content: `## ${title}\n\n${body}`,
      display: true,
    });
  }

  async function sendArcCommandOutput(ctx: ExtensionContext, title: string, args: string[], timeout = 30_000) {
    const result = await runArc(args, ctx, timeout);
    const status = result.code === 0 ? "success" : "error";
    if (ctx.hasUI) ctx.ui.notify(`arc ${args.join(" ")} ${result.code === 0 ? "completed" : "failed"}`, status);
    sendArcMessage(title, `\`arc ${args.join(" ")}\` exited with code ${result.code}.\n\n\`\`\`\n${outputOf(result)}\n\`\`\``);
  }

  pi.registerTool({
    name: "arc_agent",
    label: "Arc Agent",
    description:
      "Run a bundled Arc specialist agent (builder, reviewer, issue-manager, etc.) in a fresh Pi subprocess. Output is truncated to 50KB/2000 lines.",
    promptSnippet: "Delegate Arc issue-management, implementation, review, docs, and evaluation tasks to bundled specialist agents.",
    promptGuidelines: [
      "Use arc_agent when an Arc workflow skill asks for a builder, issue-manager, doc-writer, evaluator, spec-reviewer, or code-reviewer subagent.",
      "Use arc_agent for bulk Arc issue operations instead of keeping verbose CLI output in the main conversation.",
    ],
    parameters: Type.Object({
      agent: StringEnum(ARC_AGENT_NAMES),
      task: Type.String({ description: "Complete task prompt to give the subagent." }),
      model: Type.Optional(Type.String({ description: "Optional Pi model pattern override, e.g. haiku, sonnet, opus." })),
      isolation: Type.Optional(StringEnum(["none", "worktree"] as const)),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (params.isolation === "worktree") {
        throw new Error("arc_agent worktree isolation is not implemented yet. Use isolation='none' or run tasks sequentially.");
      }

      const agent = params.agent as ArcAgentName;
      const agentPath = path.join(AGENTS_DIR, `${agent}.md`);
      const markdown = await readFile(agentPath, "utf8");
      const config = parseAgentMarkdown(markdown);
      const selectedModel = modelPattern(params.model ?? config.model);
      const selectedTools = config.tools?.map((tool) => tool.toLowerCase()).join(",");

      const args = ["-p", "--no-session", "--system-prompt", config.prompt];
      if (selectedModel) args.push("--model", selectedModel);
      if (selectedTools) args.push("--tools", selectedTools);
      args.push(params.task);

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Running arc_agent ${agent}${selectedModel ? ` with model ${selectedModel}` : ""}...`,
          },
        ],
        details: { agent, model: selectedModel, tools: selectedTools },
      });

      const result = await runPiSubprocess(args, ctx.cwd, signal);
      const combined = outputOf(result);
      const text = truncatedOutput(combined);

      if (result.code !== 0) {
        throw new Error(`arc_agent ${agent} failed with exit code ${result.code}.\n\n${text}`);
      }

      return {
        content: [{ type: "text", text }],
        details: {
          agent,
          model: selectedModel,
          tools: selectedTools,
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    const ok = await refreshPrime(ctx);
    if (ctx.hasUI) {
      ctx.ui.notify(ok ? "arc context loaded" : "arc context unavailable", ok ? "info" : "warning");
    }

    const payload = {
      harness: "pi",
      event: "session_start",
      cwd: ctx.cwd,
      sessionFile: ctx.sessionManager.getSessionFile(),
      timestamp: new Date().toISOString(),
    };

    // Best-effort compatibility with arc AI session tracking. Older arc versions may not
    // support this payload outside Claude; failures are intentionally non-fatal.
    await runArcWithStdin(["ai", "session", "start", "--stdin"], payload, ctx.cwd, ctx.signal).catch(() => undefined);
  });

  pi.on("session_before_compact", async (_event, ctx) => {
    await refreshPrime(ctx);
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!primeCache && !primeError) {
      await refreshPrime(ctx);
    }

    const context = primeCache
      ? `<arc-context last-updated="${new Date(lastPrimeAt).toISOString()}">\n${primeCache}\n</arc-context>`
      : primeError
        ? `<arc-context status="unavailable">\narc prime failed: ${primeError}\n</arc-context>`
        : "";

    if (!context) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${context}`,
    };
  });

  pi.registerCommand("arc-refresh", {
    description: "Refresh cached arc prime context",
    handler: async (_args, ctx) => {
      const ok = await refreshPrime(ctx);
      if (ctx.hasUI) ctx.ui.notify(ok ? "arc context refreshed" : "arc prime failed", ok ? "info" : "error");
      sendArcMessage("Arc context refresh", ok ? "arc prime completed successfully." : `arc prime failed:\n\n\`\`\`\n${primeError}\n\`\`\``);
    },
  });

  pi.registerCommand("arc-prime", {
    description: "Show cached arc prime context, refreshing if needed",
    handler: async (_args, ctx) => {
      if (!primeCache && !primeError) await refreshPrime(ctx);
      if (primeCache) {
        sendArcMessage("Arc prime", `\`\`\`\n${primeCache}\n\`\`\``);
      } else {
        sendArcMessage("Arc prime unavailable", `\`\`\`\n${primeError || "No arc prime output."}\n\`\`\``);
      }
    },
  });

  pi.registerCommand("arc-onboard", {
    description: "Run arc onboard for the current project",
    handler: async (_args, ctx) => {
      await sendArcCommandOutput(ctx, "Arc onboard", ["onboard"], 60_000);
      await refreshPrime(ctx);
    },
  });

  pi.registerCommand("arc-which", {
    description: "Show which arc project is active",
    handler: async (_args, ctx) => {
      await sendArcCommandOutput(ctx, "Arc project resolution", ["which"], 30_000);
    },
  });

  for (const { command, skill, description } of WORKFLOW_SKILLS) {
    pi.registerCommand(command, {
      description,
      handler: async (args) => {
        pi.sendUserMessage(`/skill:${skill}${args.trim() ? ` ${args.trim()}` : ""}`);
      },
    });
  }
}
