// I-014: definicje narzedzi MCP jako dane. Kazde narzedzie ma poziom ryzyka (read / write / destructive), z ktorego wynikaja
// adnotacje MCP (readOnlyHint, destructiveHint, idempotentHint); narzedzia `destructive` (i warunkowo inne) wymagaja `confirm: true`.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiError, ContractError } from "./api-client";
import { log } from "./redact";

export type Risk = "read" | "write" | "destructive";

export interface ToolContext {
  signal?: AbortSignal;
}

export interface Tool {
  name: string;
  title: string;
  description: string;
  risk: Risk;
  idempotent: boolean;
  /** Minimalna rola w backpanelu albo "public" (informacyjnie, do dokumentacji). */
  role: string;
  inputSchema: z.ZodRawShape;
  /** Warunek wymagajacy `confirm: true` (zawsze dla `destructive`, a dla innych np. przy anulowaniu zamowienia). */
  needsConfirm?: (input: Record<string, unknown>) => boolean;
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export const CONFIRM_NOTE =
  " Wymaga `confirm: true`; bez niego narzedzie nic nie zmienia i zwraca opis skutku.";

interface Definition<S extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  risk: Risk;
  role?: string;
  idempotent?: boolean;
  inputSchema: S;
  needsConfirm?: (input: z.infer<z.ZodObject<S>>) => boolean;
  run: (input: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<S extends z.ZodRawShape>(def: Definition<S>): Tool {
  const destructive = def.risk === "destructive";
  const confirmable = destructive || def.needsConfirm !== undefined;
  const shape: z.ZodRawShape = {
    ...def.inputSchema,
    ...(confirmable
      ? {
          confirm: z
            .boolean()
            .optional()
            .describe("Potwierdzenie skutku (true). Bez niego narzedzie nic nie zmienia."),
        }
      : {}),
  };
  return {
    name: def.name,
    title: def.title,
    description: confirmable ? def.description + CONFIRM_NOTE : def.description,
    risk: def.risk,
    idempotent: def.idempotent ?? def.risk === "read",
    role: def.role ?? "public",
    inputSchema: shape,
    ...(def.needsConfirm
      ? { needsConfirm: def.needsConfirm as (i: Record<string, unknown>) => boolean }
      : destructive
        ? { needsConfirm: () => true }
        : {}),
    run: def.run as Tool["run"],
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.errors
      .map((e) => `${e.path ?? "?"}: ${e.message ?? e.code ?? "blad"}`)
      .join("; ");
    return `Blad API ${error.status} (${error.code}): ${error.message}${details ? ` [${details}]` : ""}${
      error.retryAfter ? ` Sprobuj ponownie po ${error.retryAfter} s.` : ""
    }`;
  }
  if (error instanceof ContractError) return error.message;
  if (error instanceof z.ZodError) return `Niepoprawne dane: ${error.issues[0]?.message ?? "blad"}`;
  return "Nieoczekiwany blad serwera MCP.";
}

export interface RegisterOptions {
  /** Zamienia surowy tekst odpowiedzi/bledu (np. maskuje sekrety). */
  redact?: (text: string) => string;
  /** Ogranicza dlugosc tekstu odpowiedzi (domyslnie 60 000 znakow). */
  maxChars?: number;
}

function text(t: string, isError = false) {
  return { content: [{ type: "text" as const, text: t }], ...(isError ? { isError: true } : {}) };
}

export async function invokeTool(
  tool: Tool,
  args: Record<string, unknown>,
  o: RegisterOptions = {},
  ctx: ToolContext = {},
) {
  const redact = o.redact ?? ((s: string) => s);
  const max = o.maxChars ?? 60_000;
  const started = Date.now();
  try {
    if (tool.needsConfirm?.(args) && args.confirm !== true) {
      return text(
        `Ta operacja zmienia dane, ktorych nie da sie latwo cofnac. Nic nie zmieniono. Powtorz wywolanie z confirm: true, jesli na pewno: ${tool.title}.`,
        true,
      );
    }
    const { confirm: _confirm, ...input } = args;
    const result = await tool.run(input, ctx);
    let out = JSON.stringify(result ?? null, null, 2);
    if (out.length > max) {
      out = `${out.slice(0, max)}\n... [ucieto, ${out.length - max} znakow; zawez zapytanie albo uzyj paginacji]`;
    }
    log("tool", { tool: tool.name, ok: true, ms: Date.now() - started });
    return text(redact(out));
  } catch (error) {
    log("tool", {
      tool: tool.name,
      ok: false,
      ms: Date.now() - started,
      status: error instanceof ApiError ? error.status : undefined,
    });
    return text(redact(errorMessage(error)), true);
  }
}

export function registerTools(
  server: McpServer,
  tools: readonly Tool[],
  o: RegisterOptions = {},
): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.risk === "read",
          destructiveHint: tool.risk === "destructive",
          idempotentHint: tool.idempotent,
          openWorldHint: false,
        },
      },
      (args: Record<string, unknown>) => invokeTool(tool, args, o),
    );
  }
}
