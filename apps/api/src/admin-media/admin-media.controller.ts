// B-500..B-508 (docs/16 par. 3.5): /v1/admin/media - lista manifestu (viewer), wgranie plikow (editor), usuniecie (owner).
// Upload to multipart: pole pliku = miejsce (`1x`, `2x`, `400`, `800`, `1600`). Wiele plikow w jednym zadaniu = komplet rozmiarow.
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
import {
  mediaListQuerySchema,
  mediaListSchema,
  mediaUploadResponseSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { Actor } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { notFound } from "../common/app-exception.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { AdminMediaService, type IncomingFile } from "./admin-media.service.js";

/** Klucz manifestu: male litery, cyfry, `_` i `-`. Cokolwiek innego (np. `../`) to 404, bez dotykania dysku. */
const KEY = /^[a-z0-9_-]{3,100}$/;
const keyPipe = {
  transform(value: unknown): string {
    if (typeof value !== "string" || !KEY.test(value))
      throw notFound("Nie ma takiego wpisu w manifeście.");
    return value;
  },
};

/** Twardy limit multipart (zabezpiecza pamiec); wlasciwy limit pliku to MEDIA_MAX_BYTES sprawdzany w serwisie. */
const HARD_LIMIT = { fileSize: 32 * 1024 * 1024, files: 4, fields: 4, parts: 8 };

@Controller("admin/media")
export class AdminMediaController {
  constructor(@Inject(AdminMediaService) private readonly media: AdminMediaService) {}

  @Get()
  @Roles("viewer")
  async list(
    @Query(new ZodPipe(mediaListQuerySchema)) query: z.output<typeof mediaListQuerySchema>,
  ) {
    return respond(mediaListSchema, await this.media.list(query));
  }

  @Post(":key")
  @Roles("editor")
  @UseInterceptors(AnyFilesInterceptor({ limits: HARD_LIMIT }))
  async upload(
    @Param("key", keyPipe) key: string,
    @UploadedFiles() files: IncomingFile[] | undefined,
    @Body() body: Record<string, unknown> | undefined,
    @Actor() ctx: AuditContext,
  ) {
    return respond(
      mediaUploadResponseSchema,
      await this.media.upload(key, files ?? [], body ?? {}, ctx),
    );
  }

  @Delete(":key")
  @Roles("owner")
  async remove(@Param("key", keyPipe) key: string, @Actor() ctx: AuditContext) {
    return respond(mediaUploadResponseSchema, await this.media.remove(key, ctx));
  }
}
