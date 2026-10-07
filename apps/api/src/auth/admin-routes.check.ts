// B-006 (docs/16 par. 4 pkt 1): kazda trasa /v1/admin/* ma jawny @Roles albo @AdminPublic. Brak = start aplikacji przerwany.
import { type OnApplicationBootstrap, Inject, Injectable } from "@nestjs/common";
import { ModulesContainer } from "@nestjs/core";
import { ADMIN_PUBLIC_KEY, ROLES_KEY } from "./decorators.js";

type Ctor = (new (...args: never[]) => object) & { prototype: Record<string, unknown> };

export interface AdminRouteInfo {
  controller: string;
  handler: string;
  httpMethod: number;
  paths: string[];
  /** minimalna rola, "public" albo undefined (brak deklaracji = blad) */
  access: string | undefined;
}

const asArray = (v: string | string[] | undefined): string[] =>
  v === undefined ? [""] : Array.isArray(v) ? v : [v];

/** Zbiera trasy kontrolerow, ktorych sciezka zaczyna sie od `admin` (prefiks `/v1` dodaje setGlobalPrefix). */
export function collectAdminRoutes(modules: ModulesContainer): AdminRouteInfo[] {
  const out: AdminRouteInfo[] = [];
  for (const mod of modules.values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as Ctor | null;
      if (!ctrl) continue;
      const bases = asArray(Reflect.getMetadata("path", ctrl) as string | string[] | undefined);
      if (!bases.some((b) => b === "admin" || b.startsWith("admin/"))) continue;
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const fn = ctrl.prototype[name];
        if (typeof fn !== "function") continue;
        const httpMethod = Reflect.getMetadata("method", fn) as number | undefined;
        if (httpMethod === undefined) continue;
        const role = (Reflect.getMetadata(ROLES_KEY, fn) ??
          Reflect.getMetadata(ROLES_KEY, ctrl)) as string | undefined;
        const isPublic = Boolean(
          Reflect.getMetadata(ADMIN_PUBLIC_KEY, fn) ?? Reflect.getMetadata(ADMIN_PUBLIC_KEY, ctrl),
        );
        out.push({
          controller: ctrl.name,
          handler: name,
          httpMethod,
          paths: asArray(Reflect.getMetadata("path", fn) as string | string[] | undefined),
          access: isPublic ? "public" : role,
        });
      }
    }
  }
  return out;
}

@Injectable()
export class AdminRoutesCheck implements OnApplicationBootstrap {
  constructor(@Inject(ModulesContainer) private readonly modules: ModulesContainer) {}

  onApplicationBootstrap(): void {
    const missing = collectAdminRoutes(this.modules).filter((r) => r.access === undefined);
    if (missing.length > 0) {
      throw new Error(
        `Trasy admina bez @Roles/@AdminPublic (B-006): ${missing.map((r) => `${r.controller}.${r.handler}`).join(", ")}`,
      );
    }
  }
}
