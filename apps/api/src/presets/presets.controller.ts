// F-111 (docs/16 par. 2): cienki kontroler presetow.
import { Controller, Get, Inject } from "@nestjs/common";
import { PresetsService } from "./presets.service.js";

@Controller("presets")
export class PresetsController {
  constructor(@Inject(PresetsService) private readonly presets: PresetsService) {}

  @Get()
  list() {
    return this.presets.list();
  }
}
