// F-020...F-026, F-029, F-060...F-072, F-069, F-062 (docs/16 par. 2): cienki kontroler katalogu.
import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import {
  completeSetQuerySchema,
  facetsQuerySchema,
  listingQuerySchema,
  productQuerySchema,
  slugSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe.js";
import { CatalogService } from "./catalog.service.js";

@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("categories")
  categories() {
    return this.catalog.categories();
  }

  @Get("products")
  products(@Query(new ZodPipe(listingQuerySchema)) q: z.output<typeof listingQuerySchema>) {
    return this.catalog.listing(q);
  }

  @Get("products/:slug")
  product(
    @Param("slug", new ZodPipe(slugSchema)) slug: string,
    @Query(new ZodPipe(productQuerySchema)) q: z.output<typeof productQuerySchema>,
  ) {
    return this.catalog.product(slug, q.sku);
  }

  @Get("products/:slug/complete-set")
  completeSet(
    @Param("slug", new ZodPipe(slugSchema)) slug: string,
    @Query(new ZodPipe(completeSetQuerySchema)) q: z.output<typeof completeSetQuerySchema>,
  ) {
    return this.catalog.completeSet(slug, q.profile, q.sku);
  }

  @Get("facets")
  facets(@Query(new ZodPipe(facetsQuerySchema)) q: z.output<typeof facetsQuerySchema>) {
    return this.catalog.facets(q);
  }

  @Get("switches")
  switches() {
    return this.catalog.switches();
  }

  @Get("colors")
  colors() {
    return this.catalog.colors();
  }
}
