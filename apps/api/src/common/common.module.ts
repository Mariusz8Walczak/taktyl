// B-212: modul wspolny (zegar). Globalny, bo zegar potrzebuja uslugi z wielu modulow.
import { Global, Module } from "@nestjs/common";
import { CLOCK, systemClock } from "./clock.js";

@Global()
@Module({ providers: [{ provide: CLOCK, useValue: systemClock }], exports: [CLOCK] })
export class CommonModule {}
