// F-250..F-256 (ADR-0011): slowniki konfiguratora z API dla komponentu serwerowego (znacznik `catalog`).
import { configuratorDataSchema, type ConfiguratorData } from "@taktyl/contracts";
import { cache } from "react";
import { apiGet } from "../api/client";
import { TAG } from "../api/tags";

export const getConfiguratorData = cache(async (): Promise<ConfiguratorData> =>
  apiGet("/v1/configurator", configuratorDataSchema, { tags: [TAG.catalog] }),
);
