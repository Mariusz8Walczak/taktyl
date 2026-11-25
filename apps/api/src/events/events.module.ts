// B-621 (ADR-0012): modul kolektora zdarzen pomiaru.
import { Module } from "@nestjs/common";
import { EventsController } from "./events.controller.js";
import { EventsService } from "./events.service.js";

@Module({ controllers: [EventsController], providers: [EventsService] })
export class EventsModule {}
