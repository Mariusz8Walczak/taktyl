// B-600..B-607: modul pulpitu backpanelu (tylko odczyt).
import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
