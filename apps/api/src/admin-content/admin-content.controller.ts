// B-300...B-309 (docs/16 par. 3.4): /v1/admin - tresci (strony, poradnik), FAQ, opisy produktow, opinie demo, zgloszenia.
// Odczyt: viewer, zapis: editor, usuwanie tresci i zgloszen: owner. PATCH tresci i PUT opisu wymagaja If-Match.
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import {
  adminContentListQuerySchema,
  adminContentListSchema,
  adminContentResponseSchema,
  adminFaqSchema,
  adminMessageListQuerySchema,
  adminMessageListSchema,
  adminProductReviewsSchema,
  adminReviewListQuerySchema,
  adminReviewListSchema,
  contentCreateSchema,
  contentPatchSchema,
  descriptionPutSchema,
  descriptionResponseSchema,
  faqPutSchema,
  messagePatchSchema,
  productIdSchema,
  reviewsPutSchema,
} from "@taktyl/contracts";
import type { Response } from "express";
import { z } from "zod";
import { Actor, Admin, type AdminPrincipal } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { etagOf, parseIfMatch } from "../common/if-match.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { AdminContentService } from "./admin-content.service.js";
import { AdminMessagesService } from "./admin-messages.service.js";
import { AdminReviewsService } from "./admin-reviews.service.js";

const idPipe = new ZodPipe(z.string().regex(/^[A-Za-z0-9_-]{6,40}$/));
const productIdPipe = new ZodPipe(productIdSchema);

@Controller("admin")
export class AdminContentController {
  constructor(
    @Inject(AdminContentService) private readonly content: AdminContentService,
    @Inject(AdminReviewsService) private readonly reviews: AdminReviewsService,
    @Inject(AdminMessagesService) private readonly messages: AdminMessagesService,
  ) {}

  // ---- strony i artykuly (B-304, B-305, B-306)

  @Get("content")
  @Roles("viewer")
  async list(
    @Query(new ZodPipe(adminContentListQuerySchema))
    query: z.output<typeof adminContentListQuerySchema>,
  ) {
    return respond(adminContentListSchema, await this.content.list(query.type));
  }

  @Get("content/:id")
  @Roles("viewer")
  async get(@Param("id", idPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const body = respond(adminContentResponseSchema, await this.content.get(id));
    res.setHeader("ETag", etagOf(body.version));
    return body;
  }

  @Post("content")
  @Roles("editor")
  @HttpCode(201)
  async create(
    @Body(new ZodPipe(contentCreateSchema)) body: z.output<typeof contentCreateSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = respond(adminContentResponseSchema, await this.content.create(body, ctx));
    res.setHeader("ETag", etagOf(out.version));
    return out;
  }

  @Patch("content/:id")
  @Roles("editor")
  async patch(
    @Param("id", idPipe) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(contentPatchSchema)) body: z.output<typeof contentPatchSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, true) as number;
    const out = respond(
      adminContentResponseSchema,
      await this.content.patch(id, body, version, ctx),
    );
    res.setHeader("ETag", etagOf(out.version));
    return out;
  }

  @Delete("content/:id")
  @Roles("owner")
  @HttpCode(204)
  async remove(@Param("id", idPipe) id: string, @Actor() ctx: AuditContext): Promise<void> {
    await this.content.remove(id, ctx);
  }

  // ---- FAQ (B-307)

  @Get("faq")
  @Roles("viewer")
  async faq() {
    return respond(adminFaqSchema, await this.content.faq());
  }

  @Put("faq")
  @Roles("editor")
  async putFaq(
    @Body(new ZodPipe(faqPutSchema)) body: z.output<typeof faqPutSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(adminFaqSchema, await this.content.putFaq(body, ctx));
  }

  // ---- opisy produktow (B-300, B-301)

  @Put("products/:id/description")
  @Roles("editor")
  async putDescription(
    @Param("id", productIdPipe) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(descriptionPutSchema)) body: z.output<typeof descriptionPutSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, true) as number;
    const out = respond(
      descriptionResponseSchema,
      await this.reviews.putDescription(id, body, version, ctx),
    );
    res.setHeader("ETag", etagOf(out.version));
    return out;
  }

  // ---- opinie demo (B-302, B-303)

  @Get("reviews")
  @Roles("viewer")
  async listReviews(
    @Query(new ZodPipe(adminReviewListQuerySchema))
    query: z.output<typeof adminReviewListQuerySchema>,
  ) {
    return respond(adminReviewListSchema, await this.reviews.list(query.product_id));
  }

  @Put("products/:id/reviews")
  @Roles("editor")
  async putReviews(
    @Param("id", productIdPipe) id: string,
    @Body(new ZodPipe(reviewsPutSchema)) body: z.output<typeof reviewsPutSchema>,
    @Actor() ctx: AuditContext,
  ) {
    return respond(adminProductReviewsSchema, await this.reviews.putReviews(id, body, ctx));
  }

  // ---- zgloszenia z formularzy (B-308, B-309)

  @Get("messages")
  @Roles("viewer")
  async listMessages(
    @Query(new ZodPipe(adminMessageListQuerySchema))
    query: z.output<typeof adminMessageListQuerySchema>,
    @Admin() admin: AdminPrincipal,
  ) {
    return respond(adminMessageListSchema, await this.messages.list(query, admin.role));
  }

  @Patch("messages/:id")
  @Roles("editor")
  @HttpCode(204)
  async patchMessage(
    @Param("id", idPipe) id: string,
    @Body(new ZodPipe(messagePatchSchema)) body: z.output<typeof messagePatchSchema>,
    @Actor() ctx: AuditContext,
  ): Promise<void> {
    await this.messages.setHandled(id, body.handled, ctx);
  }

  @Delete("messages/:id")
  @Roles("owner")
  @HttpCode(204)
  async removeMessage(@Param("id", idPipe) id: string, @Actor() ctx: AuditContext): Promise<void> {
    await this.messages.remove(id, ctx);
  }
}
