// I-014: definicje narzedzi - adnotacje z ryzyka, wymagane confirm, mapowanie bledow, maskowanie sekretow, ucinanie odpowiedzi.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ApiError,
  createRedactor,
  defineTool,
  errorMessage,
  invokeTool,
  registerTools,
} from "../src";

// Atrapa sekretu skladana w locie (skaner sekretow nie bierze jej za sekret).
const SECRET = ["SEKRET", "123456"].join("-");

const echo = defineTool({
  name: "echo",
  title: "Echo",
  description: "Zwraca wejscie.",
  risk: "read",
  inputSchema: { text: z.string() },
  run: async (i) => ({ text: i.text }),
});
const del = vi.fn(async () => ({ deleted: true }));
const destroy = defineTool({
  name: "destroy",
  title: "Usun",
  description: "Usuwa.",
  risk: "destructive",
  inputSchema: { id: z.string() },
  run: del,
});
const cancel = defineTool({
  name: "cancel",
  title: "Anuluj",
  description: "Anuluje.",
  risk: "write",
  inputSchema: { to: z.string() },
  needsConfirm: (i) => i.to === "cancelled",
  run: async () => ({ ok: true }),
});

async function connect(tools: Parameters<typeof registerTools>[1], redact?: (s: string) => string) {
  const server = new McpServer({ name: "t", version: "0" });
  registerTools(server, tools, redact ? { redact } : {});
  const client = new Client({ name: "c", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const textOf = (r: unknown) =>
  ((r as { content: { text: string }[] }).content[0] as { text: string }).text;

describe("registerTools", () => {
  it("ustawia adnotacje MCP z poziomu ryzyka", async () => {
    const client = await connect([echo, destroy, cancel]);
    const { tools } = await client.listTools();
    const by = Object.fromEntries(tools.map((t) => [t.name, t.annotations]));
    expect(by.echo).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    });
    expect(by.destroy).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(by.cancel).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it("narzedzia z confirm opisuja go w opisie i schemacie, pozostale nie", async () => {
    const client = await connect([echo, destroy, cancel]);
    const { tools } = await client.listTools();
    const d = tools.find((t) => t.name === "destroy");
    const e = tools.find((t) => t.name === "echo");
    expect(d?.description).toContain("confirm: true");
    expect(Object.keys((d?.inputSchema.properties ?? {}) as object)).toContain("confirm");
    expect(Object.keys((e?.inputSchema.properties ?? {}) as object)).not.toContain("confirm");
  });

  it("destructive bez confirm nic nie robi, z confirm: true wykonuje", async () => {
    const client = await connect([destroy]);
    const refused = await client.callTool({ name: "destroy", arguments: { id: "x" } });
    expect(refused.isError).toBe(true);
    expect(del).not.toHaveBeenCalled();
    const ok = await client.callTool({ name: "destroy", arguments: { id: "x", confirm: true } });
    expect(ok.isError).toBeFalsy();
    expect(del).toHaveBeenCalledWith({ id: "x" }, expect.anything());
  });

  it("warunkowe confirm dotyczy tylko wskazanego przypadku", async () => {
    const client = await connect([cancel]);
    expect(
      (await client.callTool({ name: "cancel", arguments: { to: "shipped" } })).isError,
    ).toBeFalsy();
    expect(
      (await client.callTool({ name: "cancel", arguments: { to: "cancelled" } })).isError,
    ).toBe(true);
    expect(
      (await client.callTool({ name: "cancel", arguments: { to: "cancelled", confirm: true } }))
        .isError,
    ).toBeFalsy();
  });

  it("maskuje sekrety w odpowiedzi i w bledzie", async () => {
    const leak = defineTool({
      name: "leak",
      title: "Leak",
      description: "x",
      risk: "read",
      inputSchema: {},
      run: async () => ({ note: `token=${SECRET} koniec` }),
    });
    const boom = defineTool({
      name: "boom",
      title: "Boom",
      description: "x",
      risk: "read",
      inputSchema: {},
      run: async () => {
        throw new ApiError(500, "internal_error", `blad ${SECRET}`);
      },
    });
    const client = await connect(
      [leak, boom],
      createRedactor(() => [SECRET]),
    );
    const a = await client.callTool({ name: "leak", arguments: {} });
    const b = await client.callTool({ name: "boom", arguments: {} });
    expect(textOf(a)).not.toContain("SEKRET");
    expect(textOf(b)).not.toContain("SEKRET");
    expect(b.isError).toBe(true);
  });
});

describe("invokeTool / errorMessage", () => {
  it("uzywa czytelnego bledu z polami walidacji API", () => {
    const msg = errorMessage(
      new ApiError(422, "validation_failed", "Niepoprawne dane", [
        { path: "stock", message: "ujemny" },
      ]),
    );
    expect(msg).toContain("422");
    expect(msg).toContain("stock: ujemny");
  });

  it("nie zdradza szczegolow nieznanych wyjatkow", () => {
    expect(errorMessage(new Error("polaczenie z baza postgres://u:p@h"))).toBe(
      "Nieoczekiwany blad serwera MCP.",
    );
  });

  it("ucina bardzo dluga odpowiedz", async () => {
    const big = defineTool({
      name: "big",
      title: "Big",
      description: "x",
      risk: "read",
      inputSchema: {},
      run: async () => ({ s: "x".repeat(5000) }),
    });
    const r = await invokeTool(big, {}, { maxChars: 100 });
    expect(r.content[0]?.text).toContain("ucieto");
  });

  it("nie wypisuje argumentow ani wynikow na stderr", async () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    await invokeTool(echo, { text: "Jan Kowalski jan@taktyl.example" });
    const written = spy.mock.calls.map((c) => String(c[0])).join("");
    spy.mockRestore();
    expect(written).toContain('"tool":"echo"');
    expect(written).not.toContain("Kowalski");
    expect(written).not.toContain("jan@");
  });
});
