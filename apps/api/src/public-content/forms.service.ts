// F-221, F-223 (docs/16 par. 2, docs/17 par. 9, docs/11): formularze kontaktu i newslettera.
// Zapis do contact_messages / newsletter_signups (widoczne w backpanelu, B-308); w demo NIC nie jest wysylane (brak SMTP).
// Dane osobowe (e-mail, tresc) nie trafiaja do logow ani do audit_log (to nie jest mutacja backpanelu); bledy bazy sa
// zamieniane na ogolny 500 bez tresci wyjatku, bo komunikaty Prisma potrafia zawierac wartosci pol.
import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import {
  FORM_DEMO_NOTICE,
  type contactFormSchema,
  type newsletterFormSchema,
} from "@taktyl/contracts";
import type { z } from "zod";
import { AppException } from "../common/app-exception.js";
import { APP_CONFIG } from "../config/config.module.js";
import type { AppConfig } from "../config/env.js";
import { Prisma } from "../prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

type ContactForm = z.output<typeof contactFormSchema>;
type NewsletterForm = z.output<typeof newsletterFormSchema>;

@Injectable()
export class FormsService {
  private readonly log = new Logger(FormsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private accepted() {
    return {
      status: "accepted" as const,
      demo: true as const,
      message: `${FORM_DEMO_NOTICE} Zgłoszenie zapisano w panelu sklepu i usuniemy je po ${this.config.MESSAGE_RETENTION_DAYS} dniach.`,
    };
  }

  private fail(e: unknown, what: string): never {
    // Tylko nazwa i kod bledu: bez message/stack (moga niesc dane osobowe).
    const code = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "-";
    this.log.error(`${what}: blad zapisu (${e instanceof Error ? e.name : "nieznany"}, ${code})`);
    throw new AppException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      "internal_error",
      "Nie udalo sie zapisac zgloszenia.",
    );
  }

  /** F-221: wiadomosc z kontaktu. */
  async contact(body: ContactForm) {
    try {
      await this.prisma.contactMessage.create({
        data: { email: body.email.toLowerCase(), subject: body.subject, body: body.message },
      });
    } catch (e) {
      this.fail(e, "formularz kontaktu");
    }
    return this.accepted();
  }

  /** F-223: zapis do newslettera; ponowny zapis tego samego e-maila daje te sama odpowiedz (bez ujawniania, kto jest zapisany). */
  async newsletter(body: NewsletterForm) {
    try {
      await this.prisma.newsletterSignup.create({ data: { email: body.email.toLowerCase() } });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) {
        this.fail(e, "newsletter");
      }
    }
    return this.accepted();
  }
}
