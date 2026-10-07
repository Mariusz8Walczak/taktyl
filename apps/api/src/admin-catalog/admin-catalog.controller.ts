// B-100...B-115 (docs/16 par. 3.2): /v1/admin - produkty, warianty, ceny, stany, gotowe sety. Odczyt: viewer, zapis: editor,
// twarde usuwanie: owner. PATCH i (opcjonalnie) PUT ceny/stanu respektuja If-Match; odpowiedzi niosa ETag = wersja.
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
  adminPresetSchema,
  adminPresetsResponseSchema,
  adminProductDetailSchema,
  adminProductListQuerySchema,
  adminProductListSchema,
  priceHistoryResponseSchema,
  presetUpdateSchema,
  productCreateSchema,
  productIdSchema,
  productPatchSchema,
  setPriceRequestSchema,
  setStockRequestSchema,
  skuSchema,
  slugSchema,
  stockMovementsResponseSchema,
  variantCreateSchema,
  variantPatchSchema,
} from "@taktyl/contracts";
import type { Response } from "express";
import type { z } from "zod";
import { Actor, Admin, type AdminPrincipal } from "../auth/admin-request.js";
import { Roles } from "../auth/decorators.js";
import type { AuditContext } from "../audit/audit.service.js";
import { etagOf, parseIfMatch } from "../common/if-match.js";
import { respond, ZodPipe } from "../common/zod.pipe.js";
import { AdminCatalogService } from "./admin-catalog.service.js";
import { AdminPresetsService } from "./admin-presets.service.js";

const idPipe = new ZodPipe(productIdSchema);
const skuPipe = new ZodPipe(skuSchema);
const presetIdPipe = new ZodPipe(slugSchema);

function withEtag<T extends { version: number }>(res: Response, body: T): T {
  res.setHeader("ETag", etagOf(body.version));
  return body;
}

@Controller("admin")
export class AdminCatalogController {
  constructor(
    @Inject(AdminCatalogService) private readonly catalog: AdminCatalogService,
    @Inject(AdminPresetsService) private readonly presets: AdminPresetsService,
  ) {}

  // ---- produkty

  @Get("products")
  @Roles("viewer")
  async list(
    @Query(new ZodPipe(adminProductListQuerySchema))
    query: z.output<typeof adminProductListQuerySchema>,
  ) {
    return respond(adminProductListSchema, await this.catalog.list(query));
  }

  @Get("products/:id")
  @Roles("viewer")
  async get(@Param("id", idPipe) id: string, @Res({ passthrough: true }) res: Response) {
    return withEtag(res, respond(adminProductDetailSchema, await this.catalog.detail(id)));
  }

  @Post("products")
  @Roles("editor")
  @HttpCode(201)
  async create(
    @Body(new ZodPipe(productCreateSchema)) body: z.output<typeof productCreateSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return withEtag(
      res,
      respond(adminProductDetailSchema, await this.catalog.createProduct(body, ctx)),
    );
  }

  @Patch("products/:id")
  @Roles("editor")
  async patch(
    @Param("id", idPipe) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(productPatchSchema)) body: z.output<typeof productPatchSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, true) as number;
    return withEtag(
      res,
      respond(adminProductDetailSchema, await this.catalog.patchProduct(id, body, version, ctx)),
    );
  }

  @Delete("products/:id")
  @Roles("owner")
  @HttpCode(204)
  async remove(@Param("id", idPipe) id: string, @Actor() ctx: AuditContext): Promise<void> {
    await this.catalog.deleteProduct(id, ctx);
  }

  // ---- warianty

  @Post("products/:id/variants")
  @Roles("editor")
  @HttpCode(201)
  async createVariant(
    @Param("id", idPipe) id: string,
    @Body(new ZodPipe(variantCreateSchema)) body: z.output<typeof variantCreateSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    return withEtag(
      res,
      respond(adminProductDetailSchema, await this.catalog.createVariant(id, body, ctx)),
    );
  }

  @Patch("variants/:sku")
  @Roles("editor")
  async patchVariant(
    @Param("sku", skuPipe) sku: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(variantPatchSchema)) body: z.output<typeof variantPatchSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, true) as number;
    return withEtag(
      res,
      respond(adminProductDetailSchema, await this.catalog.patchVariant(sku, body, version, ctx)),
    );
  }

  @Delete("variants/:sku")
  @Roles("owner")
  @HttpCode(204)
  async removeVariant(
    @Param("sku", skuPipe) sku: string,
    @Actor() ctx: AuditContext,
  ): Promise<void> {
    await this.catalog.deleteVariant(sku, ctx);
  }

  @Put("variants/:sku/price")
  @Roles("editor")
  async setPrice(
    @Param("sku", skuPipe) sku: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(setPriceRequestSchema)) body: z.output<typeof setPriceRequestSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, false);
    return withEtag(
      res,
      respond(adminProductDetailSchema, await this.catalog.setPrice(sku, body, version, ctx)),
    );
  }

  @Get("variants/:sku/price-history")
  @Roles("viewer")
  async priceHistory(@Param("sku", skuPipe) sku: string, @Admin() admin: AdminPrincipal) {
    return respond(priceHistoryResponseSchema, await this.catalog.priceHistory(sku, admin.role));
  }

  @Put("variants/:sku/stock")
  @Roles("editor")
  async setStock(
    @Param("sku", skuPipe) sku: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(setStockRequestSchema)) body: z.output<typeof setStockRequestSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, false);
    return withEtag(
      res,
      respond(adminProductDetailSchema, await this.catalog.setStock(sku, body, version, ctx)),
    );
  }

  @Get("variants/:sku/stock-movements")
  @Roles("viewer")
  async stockMovements(@Param("sku", skuPipe) sku: string, @Admin() admin: AdminPrincipal) {
    return respond(
      stockMovementsResponseSchema,
      await this.catalog.stockMovements(sku, admin.role),
    );
  }

  // ---- gotowe sety

  @Get("presets")
  @Roles("viewer")
  async listPresets() {
    return respond(adminPresetsResponseSchema, await this.presets.list());
  }

  @Put("presets/:id")
  @Roles("editor")
  async updatePreset(
    @Param("id", presetIdPipe) id: string,
    @Headers("if-match") ifMatch: string | undefined,
    @Body(new ZodPipe(presetUpdateSchema)) body: z.output<typeof presetUpdateSchema>,
    @Actor() ctx: AuditContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const version = parseIfMatch(ifMatch, true) as number;
    return withEtag(
      res,
      respond(adminPresetSchema, await this.presets.update(id, body, version, ctx)),
    );
  }
}
