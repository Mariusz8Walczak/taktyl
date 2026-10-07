// B-231 (docs/14 par. 7 A05): dokumentacja OpenAPI tylko poza produkcja albo gdy OPENAPI_ENABLED=true.
// Dostep dla roli owner w produkcji dojdzie z uwierzytelnianiem backpanelu (ADR-0006).
import { Controller, Get, Header, Inject } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { notFound } from "../common/app-exception.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { buildOpenApi, renderDocsHtml } from "./builder.js";

@Controller()
@SkipThrottle()
export class OpenApiController {
  private readonly spec = buildOpenApi();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private assertEnabled(): void {
    if (this.config.NODE_ENV === "production" && !this.config.OPENAPI_ENABLED) throw notFound();
  }

  @Get(["openapi.json", "v1/openapi.json"])
  json(): Record<string, unknown> {
    this.assertEnabled();
    return this.spec;
  }

  @Get("docs")
  @Header("Content-Type", "text/html; charset=utf-8")
  docs(): string {
    this.assertEnabled();
    return renderDocsHtml();
  }
}
