// B-212: modul wspolny (zegar). Globalny, bo zegar potrzebuja uslugi z wielu modulow.
import { Global, Module } from "@nestjs/common";
import { BrandGuard } from "./brand-guard.js";
import { CLOCK, systemClock } from "./clock.js";

@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }, BrandGuard],
  exports: [CLOCK, BrandGuard],
})
export class CommonModule {}
