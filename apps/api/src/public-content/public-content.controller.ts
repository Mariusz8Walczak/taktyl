// F-076, F-220, F-221 (docs/16 par. 2): cienki kontroler publicznych tresci i opinii.
// Cache-Control: public, max-age=0, must-revalidate + ETag ustawia requestContext (docs/16 par. 1).
import { Controller, Get, Inject, Param } from "@nestjs/common";
import { slugSchema } from "@taktyl/contracts";
import { ZodPipe } from "../common/zod.pipe.js";
import { PublicContentService } from "./public-content.service.js";

@Controller()
export class PublicContentController {
  constructor(@Inject(PublicContentService) private readonly content: PublicContentService) {}

  @Get("content/pages/:slug")
  page(@Param("slug", new ZodPipe(slugSchema)) slug: string) {
    return this.content.page(slug);
  }

  @Get("content/guides")
  guides() {
    return this.content.guides();
  }

  @Get("content/guides/:slug")
  guide(@Param("slug", new ZodPipe(slugSchema)) slug: string) {
    return this.content.guide(slug);
  }

  @Get("content/faq")
  faq() {
    return this.content.faq();
  }

  @Get("products/:slug/reviews")
  reviews(@Param("slug", new ZodPipe(slugSchema)) slug: string) {
    return this.content.reviews(slug);
  }
}
