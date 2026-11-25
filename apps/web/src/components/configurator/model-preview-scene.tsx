"use client";
// F-250, audyt P0-3 (ADR-0011 pkt 7): czesc podgladu 3D ladowana dopiero po aktywacji (dynamic import z
// model-preview.tsx). Pobiera slowniki z /api/configurator/data (raz na strone), rozwiazuje konfiguracje regulami
// z @taktyl/domain i pokazuje SceneView. Bez danych albo bez modelu zglasza "error" (rodzic zostawia render).
import type { ConfiguratorData } from "@taktyl/contracts";
import { resolveConfiguration, type Configuration } from "@taktyl/domain";
import { useEffect, useMemo, useState } from "react";
import { findModelById, toDomainData } from "../../lib/configurator/model";
import { SceneView } from "./scene-view";
import type { StageItem } from "./stage";

let dataPromise: Promise<ConfiguratorData> | null = null;

function loadData(): Promise<ConfiguratorData> {
  dataPromise ??= fetch("/api/configurator/data").then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<ConfiguratorData>;
  });
  dataPromise.catch(() => {
    dataPromise = null; // kolejna proba po bledzie sieci
  });
  return dataPromise;
}

export interface ModelPreviewSceneProps {
  modelId: string;
  title: string;
  /** Wybory czesci (puste = kolory domyslne modelu). */
  parts?: Configuration["parts"];
  onStatus: (s: "loading" | "ready" | "error") => void;
}

export default function ModelPreviewScene({
  modelId,
  title,
  parts,
  onStatus,
}: ModelPreviewSceneProps) {
  const [data, setData] = useState<ConfiguratorData | null>(null);
  useEffect(() => {
    let live = true;
    loadData()
      .then((d) => {
        if (!live) return;
        if (findModelById(d, modelId)) setData(d);
        else onStatus("error");
      })
      .catch(() => live && onStatus("error"));
    return () => {
      live = false;
    };
  }, [modelId, onStatus]);

  const items = useMemo<StageItem[]>(() => {
    const model = data ? findModelById(data, modelId) : undefined;
    if (!data || !model) return [];
    const resolved = resolveConfiguration(toDomainData(data), {
      model: model.id,
      parts: parts ?? {},
      print: null,
    });
    return [{ key: "p", model, config: resolved.config, offset: [0, 0, 0] }];
  }, [data, modelId, parts]);

  if (!data || items.length === 0) return null;
  return (
    <SceneView
      title={title}
      data={data}
      items={items}
      className="konfigurator__scena--kwadrat"
      onStatus={onStatus}
    />
  );
}
