// B-060 (TAKTYL-46): lokalny odbiornik webhooka rewalidacji do testow integracyjnych API (zamiast sklepu Next.js).
// Weryfikuje podpis tym samym kodem co API (verifySignature); tryby awarii: HTTP 500, opoznienie, zamkniete polaczenie.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { verifySignature } from "../src/outbox/signature.js";

export interface ReceivedCall {
  tags: string[] | null;
  signature: "ok" | "missing" | "stale" | "bad";
  headers: Record<string, string | string[] | undefined>;
  /** czas wlasny odbiornika, nie zegar testu */
  at: number;
}

export interface Receiver {
  url: string;
  calls: ReceivedCall[];
  /** ok = 200 po poprawnym podpisie; fail500 = zawsze 500; delay = odpowiedz po `delayMs` */
  mode: "ok" | "fail500";
  delayMs: number;
  /** Zegar uzywany do okna czasowego (domyslnie ten sam co API w testach). */
  nowMs: () => number;
  close: () => Promise<void>;
}

export async function startReceiver(secret: string, nowMs: () => number): Promise<Receiver> {
  const receiver: Receiver = {
    url: "",
    calls: [],
    mode: "ok",
    delayMs: 0,
    nowMs,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const ts = req.headers["x-taktyl-timestamp"];
      const sig = req.headers["x-taktyl-signature"];
      const signature = verifySignature({
        secret,
        timestamp: typeof ts === "string" ? ts : null,
        signature: typeof sig === "string" ? sig : null,
        body,
        nowMs: receiver.nowMs(),
      });
      let tags: string[] | null = null;
      try {
        tags = (JSON.parse(body) as { tags: string[] }).tags;
      } catch {
        tags = null;
      }
      receiver.calls.push({ tags, signature, headers: req.headers, at: Date.now() });
      const respond = (): void => {
        if (signature !== "ok") {
          res.writeHead(401, { "content-type": "application/json" }).end("{}");
        } else if (receiver.mode === "fail500") {
          res.writeHead(500, { "content-type": "application/json" }).end("{}");
        } else {
          res
            .writeHead(200, { "content-type": "application/json" })
            .end(JSON.stringify({ revalidated: tags }));
        }
      };
      if (receiver.delayMs > 0) setTimeout(respond, receiver.delayMs);
      else respond();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  receiver.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/revalidate`;
  return receiver;
}
