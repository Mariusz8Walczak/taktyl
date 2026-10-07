// B-213 (docs/14 par. 8, docs/16 par. 1): X-Request-Id, naglowki bezpieczenstwa/cache i log zadania.
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";

export type RequestWithId = Request & { id?: string };

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Sciezka logowana bez query (query moze zawierac dane uzytkownika, np. q). */
function routeOf(req: Request): string {
  const route = (req.route as { path?: string } | undefined)?.path;
  return route ? `${req.baseUrl}${route}` : req.path;
}

export function requestContext(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header("x-request-id");
    const id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
    (req as RequestWithId).id = id;
    res.setHeader("X-Request-Id", id);
    res.setHeader("X-Robots-Tag", "noindex");
    res.setHeader("Cache-Control", cacheControlFor(req));
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number((process.hrtime.bigint() - started) / 1_000_000n);
      logger.info(
        {
          requestId: id,
          route: routeOf(req),
          method: req.method,
          status: res.statusCode,
          durationMs,
        },
        "request",
      );
    });
    next();
  };
}

/** docs/16 par. 1: katalog publiczny `public, max-age=0, must-revalidate` (+ETag z Express); wycena, zamowienia, zapisy `no-store`. */
export function cacheControlFor(req: Request): string {
  const path = req.path;
  const catalogRead =
    (req.method === "GET" || req.method === "HEAD") &&
    path.startsWith("/v1/") &&
    !path.startsWith("/v1/orders") &&
    !path.startsWith("/v1/admin");
  return catalogRead ? "public, max-age=0, must-revalidate" : "no-store";
}
