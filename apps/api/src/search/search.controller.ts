// F-005 (docs/16 par. 2): cienki kontroler wyszukiwania.
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { searchQuerySchema } from "@taktyl/contracts";
import type { z } from "zod";
import { ZodPipe } from "../common/zod.pipe.js";
import { SearchService } from "./search.service.js";

@Controller("search")
export class SearchController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}

  @Get()
  find(@Query(new ZodPipe(searchQuerySchema)) q: z.output<typeof searchQuerySchema>) {
    return this.search.search(q.q, q.limit);
  }
}
