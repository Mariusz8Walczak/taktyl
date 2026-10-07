// F-005: modul wyszukiwania.
import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module.js";
import { SearchController } from "./search.controller.js";
import { SearchService } from "./search.service.js";

@Module({ imports: [CatalogModule], controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
