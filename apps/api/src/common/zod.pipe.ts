// B-210 (docs/16 par. 1): walidacja wejscia schematem Zod z @taktyl/contracts. Cialo: 422, query/param: 400.
import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ProblemFieldError } from "@taktyl/contracts";
import type { z } from "zod";
import { validationFailed } from "./app-exception.js";

/** Sciezka bledu w stylu `items[0].sku`. */
export function issuePath(path: readonly PropertyKey[]): string {
  let out = "";
  for (const seg of path) {
    out += typeof seg === "number" ? `[${seg}]` : out === "" ? String(seg) : `.${String(seg)}`;
  }
  return out;
}

export function zodErrors(error: z.ZodError): ProblemFieldError[] {
  return error.issues.map((i) => ({ path: issuePath(i.path), code: i.code, message: i.message }));
}

export class ZodPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown, metadata: ArgumentMetadata): z.output<S> {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      throw validationFailed(zodErrors(parsed.error), metadata.type === "body" ? 422 : 400);
    }
    return parsed.data;
  }
}

/** Parsuje odpowiedz schematem kontraktu (wyjscie nie wycieka poza kontrakt, np. regular_price). */
export function respond<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  return schema.parse(value);
}
