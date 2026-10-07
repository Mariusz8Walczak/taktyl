// B-213 (docs/14 par. 8): logi strukturalne JSON (pino) z polem service; bez danych osobowych i sekretow.
import type { LoggerService } from "@nestjs/common";
import pino, { type Logger } from "pino";

export function createLogger(level: string, enabled = true): Logger {
  return pino({
    level: enabled ? level : "silent",
    base: { service: "api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: ["req.headers.authorization", "req.headers.cookie", "req.headers['x-order-token']"],
  });
}

/** Adapter Nest -> pino (komunikaty frameworka tez ida jako JSON). */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly out: Logger) {}
  log_(level: "info" | "error" | "warn" | "debug" | "trace", message: unknown, ctx?: string): void {
    this.out[level](
      { context: ctx },
      typeof message === "string" ? message : JSON.stringify(message),
    );
  }
  log(message: unknown, ...rest: unknown[]): void {
    this.log_("info", message, ctxOf(rest));
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.log_("error", message, ctxOf(rest.slice(-1)));
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.log_("warn", message, ctxOf(rest));
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.log_("debug", message, ctxOf(rest));
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.log_("trace", message, ctxOf(rest));
  }
}

function ctxOf(rest: unknown[]): string | undefined {
  const last = rest[rest.length - 1];
  return typeof last === "string" ? last : undefined;
}
