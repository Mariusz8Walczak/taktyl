"use client";
// F-250 (ADR-0011): scena 3D konfiguratora. three.js i dekoder Draco ladowane dynamicznie dopiero tutaj (po wejsciu na
// strone konfiguratora), wiec nie wchodza do budzetu JS pozostalych stron. Renderowanie na zadanie (bez petli
// animacji): obrot, zmiana farb i zmiana rozmiaru. Model i dekoder to pliki wlasne (`/3d`), bez CDN.
// Wymiary i kolory pochodza z danych, nie z kodu; zadnej wlasnej grafiki.
import type { ConfiguratorData } from "@taktyl/contracts";
import type * as T from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";
import type { Configuration } from "@taktyl/domain";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { partPaint, printMapping } from "../../lib/configurator/model";

type Model = ConfiguratorData["models"][number];

export interface StageHandle {
  rotate: (deg: number) => void;
  view: (v: "front" | "top") => void;
}

interface Props {
  model: Model;
  data: ConfiguratorData;
  config: Configuration;
  handleRef?: Ref<StageHandle>;
  onStatus?: (s: "loading" | "ready" | "error") => void;
}

/** Zmienne three.js trzymane w refie, zeby efekty nie tworzyly sceny od nowa. */
interface Runtime {
  THREE: typeof T;
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  controls: OrbitControlsType;
  root: T.Object3D;
  meshes: Map<string, T.Mesh>;
  render: () => void;
  dispose: () => void;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function Stage({ model, data, config, handleRef, onStatus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime | null>(null);
  const [ready, setReady] = useState(false);
  const status = useRef(onStatus);
  status.current = onStatus;

  // Budowa sceny i wczytanie modelu (od nowa tylko dla innego modelu).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    setReady(false);
    status.current?.("loading");

    (async () => {
      const THREE = await import("three");
      const [{ GLTFLoader }, { DRACOLoader }, { OrbitControls }, { RoomEnvironment }] =
        await Promise.all([
          import("three/addons/loaders/GLTFLoader.js"),
          import("three/addons/loaders/DRACOLoader.js"),
          import("three/addons/controls/OrbitControls.js"),
          import("three/addons/environments/RoomEnvironment.js"),
        ]);
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = false;
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = Math.PI / 2 - 0.05;

      const draco = new DRACOLoader().setDecoderPath("/3d/draco/");
      const loader = new GLTFLoader().setDRACOLoader(draco);
      const base = `/3d/${model.file}`;
      let gltf;
      try {
        gltf = await loader.loadAsync(base);
      } catch {
        renderer.dispose();
        draco.dispose();
        if (!cancelled) status.current?.("error");
        return;
      }
      if (cancelled) {
        renderer.dispose();
        draco.dispose();
        return;
      }

      const root = gltf.scene;
      const meshes = new Map<string, T.Mesh>();
      root.traverse((o) => {
        if ((o as T.Mesh).isMesh) meshes.set(o.name, o as T.Mesh);
      });
      scene.add(root);

      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z);
      const target = new THREE.Vector3(0, size.y / 2, 0);
      controls.target.copy(target);
      camera.position.set(
        target.x + radius * 1.4,
        target.y + radius * 1.7,
        target.z + radius * 2.6,
      );
      controls.minDistance = radius * 1.2;
      controls.maxDistance = radius * 6;
      controls.update();

      const render = () => renderer.render(scene, camera);
      controls.addEventListener("change", render);
      const resize = () => {
        const w = Math.max(el.clientWidth, 1);
        const h = Math.max(el.clientHeight, 1);
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        render();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(el);
      resize();

      const dispose = () => {
        ro.disconnect();
        controls.dispose();
        draco.dispose();
        scene.traverse((o) => {
          const m = (o as T.Mesh).material as T.Material | T.Material[] | undefined;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose();
          (o as T.Mesh).geometry?.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
      cleanup = dispose;
      rt.current = { THREE, renderer, scene, camera, controls, root, meshes, render, dispose };
      setReady(true);
      status.current?.("ready");
    })().catch(() => {
      if (!cancelled) status.current?.("error");
    });

    return () => {
      cancelled = true;
      rt.current = null;
      cleanup?.();
    };
  }, [model.id, model.file]);

  // Farby czesci i nadruk podkladki przy kazdej zmianie konfiguracji.
  useEffect(() => {
    const r = rt.current;
    if (!r || !ready) return;
    const { THREE, meshes } = r;
    let cancelled = false;

    for (const [partId, mesh] of meshes) {
      const paint = partPaint(data, config, partId);
      if (!paint) continue;
      const old = mesh.material as T.Material;
      const params: Record<string, unknown> = { ...paint.pbr };
      const mat = new THREE.MeshPhysicalMaterial(params as T.MeshPhysicalMaterialParameters);
      if (paint.emissive) {
        mat.color.copy(new THREE.Color(0, 0, 0));
        mat.emissive.set(paint.color);
        mat.emissiveIntensity = 1;
      } else {
        mat.color.set(paint.color);
      }
      mesh.material = mat;
      old.dispose();
    }

    const top = meshes.get("wierzch");
    const print = config.print ? data.prints.find((p) => p.id === config.print) : undefined;
    if (top && print) {
      new THREE.TextureLoader().loadAsync(`/3d/${print.plik}`).then((tex) => {
        if (cancelled || !rt.current) return;
        tex.flipY = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        const map = printMapping(print, model.dims_mm);
        tex.repeat.set(...map.repeat);
        tex.offset.set(...map.offset);
        const mat = top.material as T.MeshPhysicalMaterial;
        mat.map = tex;
        mat.color.copy(new THREE.Color(1, 1, 1));
        mat.needsUpdate = true;
        r.render();
      });
    }
    r.render();
    return () => {
      cancelled = true;
    };
  }, [config, data, ready, model.dims_mm]);

  useImperativeHandle(
    handleRef,
    () => ({
      rotate(deg) {
        const r = rt.current;
        if (!r) return;
        r.root.rotation.y += (deg * Math.PI) / 180;
        r.render();
      },
      view(v) {
        const r = rt.current;
        if (!r) return;
        const { camera, controls, root, THREE } = r;
        root.rotation.y = 0;
        const box = new THREE.Box3().setFromObject(root);
        const s = box.getSize(new THREE.Vector3());
        const radius = Math.max(s.x, s.y, s.z);
        const t = controls.target;
        if (v === "top") camera.position.set(t.x, t.y + radius * 3.6, t.z + 0.001);
        else camera.position.set(t.x, t.y + radius * 0.5, t.z + radius * 3.4);
        controls.update();
        r.render();
      },
    }),
    [],
  );

  return <div ref={host} className="konfigurator__scena-plotno" />;
}
