"use client";
// F-250, F-255 (ADR-0011): scena 3D konfiguratora. three.js i dekoder Draco ladowane dynamicznie dopiero tutaj (po wejsciu na
// strone konfiguratora), wiec nie wchodza do budzetu JS pozostalych stron. Renderowanie na zadanie (bez petli
// animacji): obrot, zmiana farb i zmiana rozmiaru. Model i dekoder to pliki wlasne (`/3d`), bez CDN.
// Scena trzyma liste elementow (jedna sztuka na stronie produktu, trzy w „Stworz wlasny set”), kazdy z wlasnym
// przesunieciem; zmiana modelu jednego elementu laduje tylko ten element. Wymiary i kolory pochodza z danych.
// F-257 (wydajnosc na slabym sprzecie): DPR maks. 1,5 (1 w trakcie przeciagania), antialias tylko przy DPR < 2,
// MeshStandardMaterial zamiast Physical, gdy wykonczenie nie potrzebuje clearcoat/sheen/transmisji/iryzacji; materialy
// z pamieci podrecznej po kluczu farby (bez rekompilacji shaderow przy kazdej zmianie), transmisja z modelu GLB
// (czesci niemalowane, np. przelaczniki) zastapiona przezroczystoscia - bez dodatkowego przebiegu transmisji co klatke,
// gdy klient nie wybral wykonczenia polprzezroczystego; compileAsync po zaladowaniu; scena poza ekranem nie rysuje.
import type { ConfiguratorData } from "@taktyl/contracts";
import type { Configuration } from "@taktyl/domain";
import type * as T from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";
import type { GLTFLoader as GLTFLoaderType } from "three/addons/loaders/GLTFLoader.js";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { partPaint, printMapping } from "../../lib/configurator/model";

type Model = ConfiguratorData["models"][number];

export interface StageItem {
  /** Stabilny klucz miejsca (np. "k", "m", "p"); zmiana modelu pod tym samym kluczem przeladowuje element. */
  key: string;
  model: Model;
  config: Configuration;
  /** Przesuniecie w metrach (x w prawo, y w gore, z do uzytkownika). */
  offset: [number, number, number];
}

export interface StageHandle {
  rotate: (deg: number) => void;
  view: (v: "front" | "top") => void;
}

interface Props {
  data: ConfiguratorData;
  items: StageItem[];
  handleRef?: Ref<StageHandle>;
  onStatus?: (s: "loading" | "ready" | "error") => void;
  /** Audyt UX: klikniecie (nie przeciagniecie) czesci modelu - id czesci (nazwa siatki) i klucz elementu. */
  onPick?: (partId: string, itemKey: string) => void;
}

interface Loaded {
  modelId: string;
  offsetKey: string;
  obj: T.Object3D;
  meshes: Map<string, T.Mesh>;
}

/** Zmienne three.js trzymane w refie, zeby efekty nie tworzyly sceny od nowa. */
interface Runtime {
  THREE: typeof T;
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  controls: OrbitControlsType;
  group: T.Group;
  loader: GLTFLoaderType;
  loaded: Map<string, Loaded>;
  render: () => void;
  frame: () => void;
  /** Materialy wedlug klucza farby (jeden program shadera na rodzaj wykonczenia). */
  materials: Map<string, T.Material>;
}

/** Parametry wymagajace MeshPhysicalMaterial (reszta wykonczen to MeshStandardMaterial - tanszy shader). */
const PHYSICAL_KEYS = ["clearcoat", "sheen", "transmission", "iridescence", "ior", "thickness"];
/** Maks. gestosc pikseli: powyzej 1,5 koszt rosnie z kwadratem, a roznica jest ledwo widoczna. */
const MAX_DPR = 1.5;

export default function Stage({ data, items, handleRef, onStatus, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [modelsVersion, setModelsVersion] = useState(0);
  const status = useRef(onStatus);
  status.current = onStatus;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // Scena, kamera, sterowanie i oswietlenie: raz na zamontowanie.
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
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

      const deviceDpr = window.devicePixelRatio || 1;
      const dpr = Math.min(deviceDpr, MAX_DPR);
      const renderer = new THREE.WebGLRenderer({
        antialias: deviceDpr < 2,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(dpr);
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
      const group = new THREE.Group();
      scene.add(group);

      const draco = new DRACOLoader().setDecoderPath("/3d/draco/");
      const loader = new GLTFLoader().setDRACOLoader(draco);

      // Scena poza ekranem nie rysuje (kilka podgladow na jednej stronie); po powrocie jedna klatka.
      let visible = true;
      let dirty = false;
      const render = () => {
        if (!visible) {
          dirty = true;
          return;
        }
        dirty = false;
        renderer.render(scene, camera);
      };
      const io =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver((entries) => {
              visible = entries.some((e) => e.isIntersecting);
              if (visible && dirty) render();
            });
      io?.observe(el);
      controls.addEventListener("change", render);
      // W trakcie przeciagania DPR 1 (plynny obrot), po puszczeniu pelna jakosc i jedna klatka.
      controls.addEventListener("start", () => {
        if (dpr > 1) renderer.setPixelRatio(1);
      });
      controls.addEventListener("end", () => {
        if (dpr > 1) {
          renderer.setPixelRatio(dpr);
          render();
        }
      });

      /** Kadruje kamere na wszystkie elementy (po zaladowaniu albo zmianie skladu). */
      const frame = () => {
        const box = new THREE.Box3().setFromObject(group);
        if (box.isEmpty()) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z);
        const target = new THREE.Vector3(center.x, size.y / 2, center.z);
        controls.target.copy(target);
        camera.position.set(
          target.x + radius * 1.1,
          target.y + radius * 1.4,
          target.z + radius * 2.1,
        );
        controls.minDistance = radius * 1.2;
        controls.maxDistance = radius * 6;
        controls.update();
        render();
      };

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

      // Audyt UX: klikniecie czesci otwiera jej sekcje (raycast; przeciagniecie obracajace model nie jest kliknieciem)
      const ray = new THREE.Raycaster();
      let down: { x: number; y: number } | null = null;
      const onDown = (e: PointerEvent) => {
        down = { x: e.clientX, y: e.clientY };
      };
      const onUp = (e: PointerEvent) => {
        const start = down;
        down = null;
        if (!start || !pickRef.current) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(group, true)[0];
        if (!hit) return;
        const r = rt.current;
        if (!r) return;
        for (const [key, l] of r.loaded) {
          for (const [partId, mesh] of l.meshes) {
            if (mesh === hit.object) {
              pickRef.current(partId, key);
              return;
            }
          }
        }
      };
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointerup", onUp);

      const materials = new Map<string, T.Material>();
      cleanup = () => {
        io?.disconnect();
        materials.forEach((m) => m.dispose());
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointerup", onUp);
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
        renderer.forceContextLoss(); // zwolnienie kontekstu WebGL od razu (limit kontekstow na strone)
        renderer.domElement.remove();
      };
      rt.current = {
        THREE,
        renderer,
        scene,
        camera,
        controls,
        group,
        loader,
        loaded: new Map(),
        render,
        frame,
        materials,
      };
      setSceneReady(true);
    })().catch(() => {
      if (!cancelled) status.current?.("error");
    });

    return () => {
      cancelled = true;
      rt.current = null;
      setSceneReady(false);
      cleanup?.();
    };
  }, []);

  // Sklad sceny: ladowanie tylko zmienionych elementow (inny model albo inne przesuniecie pod danym kluczem).
  const layoutKey = items.map((i) => `${i.key}:${i.model.id}:${i.offset.join(",")}`).join("|");
  useEffect(() => {
    const r = rt.current;
    if (!r || !sceneReady) return;
    let cancelled = false;
    status.current?.("loading");
    const wanted = itemsRef.current;

    for (const [key, l] of r.loaded) {
      const w = wanted.find((i) => i.key === key);
      if (!w || w.model.id !== l.modelId) {
        r.group.remove(l.obj);
        r.loaded.delete(key);
      }
    }

    (async () => {
      let changed = false;
      await Promise.all(
        wanted.map(async (item) => {
          const offsetKey = item.offset.join(",");
          const existing = r.loaded.get(item.key);
          if (existing) {
            if (existing.offsetKey !== offsetKey) {
              existing.obj.position.set(...item.offset);
              existing.offsetKey = offsetKey;
              changed = true;
            }
            return;
          }
          const gltf = await r.loader.loadAsync(`/3d/${item.model.file}`);
          if (cancelled || !rt.current) return;
          const { THREE } = r;
          const obj = gltf.scene;
          obj.position.set(...item.offset);
          const meshes = new Map<string, T.Mesh>();
          obj.traverse((o) => {
            if (!(o as T.Mesh).isMesh) return;
            const mesh = o as T.Mesh;
            meshes.set(o.name, mesh);
            // F-257: transmisja z pliku (np. przelaczniki pod klawiszami) = dodatkowy przebieg co klatke; zamiast niej
            // przezroczystosc o tym samym kolorze (czesci malowane i tak dostaja material z farby ponizej).
            const m = mesh.material as T.MeshPhysicalMaterial;
            if (m && (m.transmission ?? 0) > 0) {
              const std = new THREE.MeshStandardMaterial({
                color: m.color,
                roughness: m.roughness,
                metalness: m.metalness,
                transparent: true,
                opacity: Math.max(0.35, 1 - m.transmission * 0.6),
              });
              m.dispose();
              mesh.material = std;
            }
          });
          r.group.add(obj);
          r.loaded.set(item.key, { modelId: item.model.id, offsetKey, obj, meshes });
          changed = true;
        }),
      );
      if (cancelled) return;
      if (changed) r.frame();
      setModelsVersion((v) => v + 1);
      status.current?.("ready");
    })().catch(() => {
      if (!cancelled) status.current?.("error");
    });
    return () => {
      cancelled = true;
    };
  }, [layoutKey, sceneReady]);

  // Farby czesci i nadruk podkladki przy kazdej zmianie konfiguracji.
  useEffect(() => {
    const r = rt.current;
    if (!r || !sceneReady) return;
    const { THREE } = r;
    let cancelled = false;

    for (const item of items) {
      const loaded = r.loaded.get(item.key);
      if (!loaded || loaded.modelId !== item.model.id) continue;
      for (const [partId, mesh] of loaded.meshes) {
        const paint = partPaint(data, item.config, partId);
        if (!paint) continue;
        // Nadruk podkladki ustawia wlasna mape na materiale - ten material nie jest wspoldzielony.
        const own = partId === "wierzch" && Boolean(item.config.print);
        const key = `${paint.color}|${paint.emissive ? 1 : 0}|${JSON.stringify(paint.pbr)}`;
        if (!own && mesh.userData.paintKey === key) continue;
        let mat = own ? undefined : r.materials.get(key);
        if (!mat) {
          const pbr = paint.pbr as Record<string, unknown>;
          const physical = PHYSICAL_KEYS.some((k) => k in pbr);
          const m = physical
            ? new THREE.MeshPhysicalMaterial(pbr as unknown as T.MeshPhysicalMaterialParameters)
            : new THREE.MeshStandardMaterial(pbr as unknown as T.MeshStandardMaterialParameters);
          if (paint.emissive) {
            m.color.copy(new THREE.Color(0, 0, 0));
            m.emissive.set(paint.color);
            m.emissiveIntensity = 1;
          } else {
            m.color.set(paint.color);
          }
          mat = m;
          if (!own) r.materials.set(key, m);
        }
        const old = mesh.material as T.Material;
        mesh.material = mat;
        mesh.userData.paintKey = own ? null : key;
        // material z pamieci podrecznej moze byc uzywany przez inne czesci - zwalniamy tylko wlasne
        if (old !== mat && ![...r.materials.values()].includes(old)) old.dispose();
      }

      const top = loaded.meshes.get("wierzch");
      const print = item.config.print
        ? data.prints.find((p) => p.id === item.config.print)
        : undefined;
      if (top && print) {
        new THREE.TextureLoader().loadAsync(`/3d/${print.plik}`).then((tex) => {
          if (cancelled || !rt.current) return;
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 8;
          const map = printMapping(print, item.model.dims_mm);
          tex.repeat.set(...map.repeat);
          tex.offset.set(...map.offset);
          const mat = top.material as T.MeshStandardMaterial;
          mat.map = tex;
          mat.color.copy(new THREE.Color(1, 1, 1));
          mat.needsUpdate = true;
          r.render();
        });
      }
    }
    // F-257: nowe programy shaderow kompilowane w tle (KHR_parallel_shader_compile), dopiero potem klatka -
    // bez przyciecia przy pierwszym obrocie; gdy kompilacja asynchroniczna niedostepna, zwykly render.
    const compile = (
      r.renderer as T.WebGLRenderer & {
        compileAsync?: (s: T.Object3D, c: T.Camera) => Promise<unknown>;
      }
    ).compileAsync;
    if (compile) {
      compile
        .call(r.renderer, r.scene, r.camera)
        .catch(() => undefined)
        .then(() => {
          if (!cancelled && rt.current) r.render();
        });
    } else r.render();
    return () => {
      cancelled = true;
    };
  }, [items, data, sceneReady, modelsVersion]);

  useImperativeHandle(
    handleRef,
    () => ({
      rotate(deg) {
        const r = rt.current;
        if (!r) return;
        r.group.rotation.y += (deg * Math.PI) / 180;
        r.render();
      },
      view(v) {
        const r = rt.current;
        if (!r) return;
        const { camera, controls, group, THREE } = r;
        group.rotation.y = 0;
        const box = new THREE.Box3().setFromObject(group);
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
