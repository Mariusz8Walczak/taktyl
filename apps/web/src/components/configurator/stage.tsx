"use client";
// F-250, F-255 (ADR-0011): scena 3D konfiguratora. three.js i dekoder Draco ladowane dynamicznie dopiero tutaj (po wejsciu na
// strone konfiguratora), wiec nie wchodza do budzetu JS pozostalych stron. Renderowanie na zadanie: petla klatek dziala
// tylko w trakcie ruchu wywolanego przez klienta (przeciaganie z wygaszeniem, przejscie A-19), potem staje.
// Scena trzyma liste elementow (jedna sztuka na stronie produktu, trzy w „Stworz wlasny set”), kazdy z wlasnym
// przesunieciem; zmiana modelu jednego elementu laduje tylko ten element. Wymiary i kolory pochodza z danych.
// F-257: kadr dopasowany do bryly, swiatlo kierunkowe z cieniem na blacie, wskazanie i klikniecie czesci na modelu.
// A-19 (docs/07): obrot przyciskami i zmiana widoku jako przejscie kamery `--d-l` · `--e-wyjscie`; przy
// `prefers-reduced-motion: reduce` czas spada do zera, a wygaszanie obrotu jest wylaczone.
import type { ConfiguratorData } from "@taktyl/contracts";
import type { Configuration } from "@taktyl/domain";
import type * as T from "three";
import type { OrbitControls as OrbitControlsType } from "three/addons/controls/OrbitControls.js";
import type { GLTFLoader as GLTFLoaderType } from "three/addons/loaders/GLTFLoader.js";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { configurableParts, partPaint, printMapping } from "../../lib/configurator/model";

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
  /** Klikniecie czesci na modelu (klucz elementu, id czesci). */
  onPick?: (itemKey: string, partId: string) => void;
}

interface Loaded {
  modelId: string;
  offsetKey: string;
  obj: T.Object3D;
  meshes: Map<string, T.Mesh>;
}

interface Pose {
  pos: T.Vector3;
  target: T.Vector3;
  rot: number;
}

interface Tween {
  from: Pose;
  to: Pose;
  start: number;
  dur: number;
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
  frame: (animate: boolean) => void;
  goTo: (to: Pose) => void;
  /** Obrot, do ktorego zmierza scena (koniec trwajacego przejscia albo obecny). */
  aimRot: () => number;
  poseFor: (dir: T.Vector3, rot: number) => Pose;
  clearHover: () => void;
}

/** Kierunek kamery (od celu) z kata obrotu wokol osi pionowej i wzniesienia, w stopniach. */
const DEFAULT_VIEW = { az: 22, el: 34 } as const;
const VIEWS = { front: { az: 0, el: 14 }, top: { az: 0, el: 80 } } as const;
/** Czesc kadru zajeta przez bryle (reszta to margines; przyciski obrotu stoja w osobnym wierszu pod plotnem). */
const FILL_H = 0.94;
const FILL_V = 0.86;

/** Wartosc tokenu z `:root` (regula 2: czasy, krzywe i kolory tylko z tokenow). */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Czas tokenu w ms ("300ms", "0.3s"; przy reduced motion tokeny maja 0). */
function durationMs(name: string): number {
  const v = token(name);
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return v.endsWith("ms") ? n : n * 1000;
}

/** Krzywa `cubic-bezier(x1, y1, x2, y2)` z tokenu jako funkcja postepu 0..1. */
function easing(name: string): (x: number) => number {
  const m = /cubic-bezier\(([^)]+)\)/.exec(token(name));
  const p = m?.[1]?.split(",").map(Number) ?? [];
  if (p.length !== 4 || p.some((n) => !Number.isFinite(n))) return (x) => x;
  const [x1, y1, x2, y2] = p as [number, number, number, number];
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function Stage({ data, items, handleRef, onStatus, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const rt = useRef<Runtime | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [modelsVersion, setModelsVersion] = useState(0);
  const status = useRef(onStatus);
  status.current = onStatus;
  const pick = useRef(onPick);
  pick.current = onPick;
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Scena, kamera, sterowanie, oswietlenie i wskazywanie czesci: raz na zamontowanie.
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

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      scene.environment = pmrem.fromScene(envScene, 0.04).texture;
      scene.environmentIntensity = 0.85;
      envScene.dispose();
      pmrem.dispose();

      // Swiatlo kluczowe z gory z lewej, od strony uzytkownika; rzuca miekki cien na blat i na podkladke.
      const sun = new THREE.DirectionalLight(undefined, 1.4);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.radius = 6;
      sun.shadow.blurSamples = 16;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.0015;
      scene.add(sun, sun.target);
      const sunDir = new THREE.Vector3(-0.45, 1, 0.55).normalize();

      // Blat: niewidoczna plaszczyzna, ktora pokazuje tylko cien (bryla nie wisi w powietrzu).
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShadowMaterial({ opacity: 0.22 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.enableDamping = !reducedMotion();
      controls.dampingFactor = 0.12;
      controls.rotateSpeed = 0.8;
      controls.minPolarAngle = 0.15;
      // Bez widoku z poziomu blatu: podkladka zamienia sie wtedy w kreske.
      controls.maxPolarAngle = THREE.MathUtils.degToRad(70);
      const group = new THREE.Group();
      scene.add(group);

      const draco = new DRACOLoader().setDecoderPath("/3d/draco/");
      const loader = new GLTFLoader().setDRACOLoader(draco);

      const render = () => renderer.render(scene, camera);

      // Petla klatek tylko w trakcie ruchu (przeciaganie, wygaszanie, przejscie A-19).
      let tween: Tween | null = null;
      let dragging = false;
      let raf = 0;
      const ease = easing("--e-wyjscie");
      const tick = (now: number) => {
        raf = 0;
        let active = dragging;
        if (tween) {
          const k = tween.dur > 0 ? Math.min(1, (now - tween.start) / tween.dur) : 1;
          const e = ease(k);
          camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
          controls.target.lerpVectors(tween.from.target, tween.to.target, e);
          group.rotation.y = tween.from.rot + (tween.to.rot - tween.from.rot) * e;
          if (k >= 1) tween = null;
          else active = true;
        }
        if (controls.update()) active = true;
        render();
        if (active) raf = requestAnimationFrame(tick);
      };
      const kick = () => {
        if (!raf) raf = requestAnimationFrame(tick);
      };
      controls.addEventListener("change", kick);
      controls.addEventListener("start", () => {
        dragging = true;
        tween = null;
        kick();
      });
      controls.addEventListener("end", () => {
        dragging = false;
        kick();
      });

      /** Bryla wszystkich elementow przy zadanym obrocie grupy (bez zmiany stanu sceny). */
      const boxAt = (rot: number) => {
        const prev = group.rotation.y;
        group.rotation.y = rot;
        group.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(group);
        group.rotation.y = prev;
        group.updateMatrixWorld(true);
        return box;
      };

      /** Kierunek kamery z katow w stopniach. */
      const dirFrom = (az: number, el: number) => {
        const a = THREE.MathUtils.degToRad(az);
        const e = THREE.MathUtils.degToRad(el);
        return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
      };

      /**
       * Pozycja kamery, w ktorej bryla wypelnia kadr: dla kazdego naroznika pudla liczona jest odleglosc, przy ktorej
       * miesci sie w polu widzenia (osobno w poziomie i w pionie); bierzemy najwieksza.
       */
      const poseFor = (dir: T.Vector3, rot: number): Pose => {
        const box = boxAt(rot);
        const target = box.getCenter(new THREE.Vector3());
        const d = dir.clone().normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        const right = worldUp.clone().cross(d);
        if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
        right.normalize();
        const up = d.clone().cross(right).normalize();
        const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const tanH = tanV * camera.aspect;
        const corners: T.Vector3[] = [];
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
        const p = new THREE.Vector3();
        let dist = 0;
        // Perspektywa przesuwa obraz bryly w bok (blizsze narozniki sa wieksze), wiec cel jest dwukrotnie
        // przesuwany na srodek rzutu, a odleglosc liczona od nowa.
        for (let pass = 0; pass < 3; pass++) {
          dist = 0;
          for (const c of corners) {
            p.copy(c).sub(target);
            const along = p.dot(d);
            dist = Math.max(
              dist,
              along + Math.abs(p.dot(right)) / (tanH * FILL_H),
              along + Math.abs(p.dot(up)) / (tanV * FILL_V),
            );
          }
          if (pass === 2) break;
          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;
          for (const c of corners) {
            p.copy(c).sub(target);
            const depth = dist - p.dot(d);
            const sx = p.dot(right) / depth;
            const sy = p.dot(up) / depth;
            minX = Math.min(minX, sx);
            maxX = Math.max(maxX, sx);
            minY = Math.min(minY, sy);
            maxY = Math.max(maxY, sy);
          }
          target
            .addScaledVector(right, ((minX + maxX) / 2) * dist)
            .addScaledVector(up, ((minY + maxY) / 2) * dist);
        }
        return { pos: target.clone().add(d.multiplyScalar(dist)), target, rot };
      };

      const goTo = (to: Pose) => {
        tween = {
          from: { pos: camera.position.clone(), target: controls.target.clone(), rot: group.rotation.y },
          to,
          start: performance.now(),
          dur: durationMs("--d-l"),
        };
        kick();
      };

      /** Cien i blat pod aktualna bryla. */
      const fitShadow = () => {
        const box = boxAt(0);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const r = Math.max(size.x, size.z, size.y) * 0.75;
        ground.position.set(center.x, box.min.y - 0.0003, center.z);
        ground.scale.set(r * 8, r * 8, 1);
        sun.target.position.copy(center);
        sun.position.copy(center).addScaledVector(sunDir, r * 4);
        const cam = sun.shadow.camera;
        cam.left = -r * 1.3;
        cam.right = r * 1.3;
        cam.top = r * 1.3;
        cam.bottom = -r * 1.3;
        cam.near = 0.01;
        cam.far = r * 8;
        cam.updateProjectionMatrix();
        sun.shadow.needsUpdate = true;
      };

      /** Kadruje kamere na wszystkie elementy; przy zmianie skladu zachowuje kierunek patrzenia klienta. */
      let framed = false;
      const frame = (animate: boolean) => {
        if (new THREE.Box3().setFromObject(group).isEmpty()) return;
        fitShadow();
        const dir = framed
          ? camera.position.clone().sub(controls.target)
          : dirFrom(DEFAULT_VIEW.az, DEFAULT_VIEW.el);
        const pose = poseFor(dir, group.rotation.y);
        const dist = pose.pos.distanceTo(pose.target);
        controls.minDistance = dist * 0.45;
        controls.maxDistance = dist * 2.5;
        if (animate && framed) {
          goTo(pose);
        } else {
          camera.position.copy(pose.pos);
          controls.target.copy(pose.target);
          controls.update();
          render();
        }
        framed = true;
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

      // F-257: wskazanie czesci (podswietlenie kolorem akcentu) i klikniecie (wybor czesci w panelu).
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      type Hit = { key: string; partId: string };
      let hovered: { hit: Hit; saved: { mat: T.MeshStandardMaterial; color: T.Color; intensity: number }[] } | null =
        null;

      const hitAt = (clientX: number, clientY: number): Hit | null => {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(group, true);
        for (const h of hits) {
          for (const item of itemsRef.current) {
            const loaded = rt.current?.loaded.get(item.key);
            if (!loaded) continue;
            const pickable = new Set(configurableParts(item.model).map((p) => p.id));
            let o: T.Object3D | null = h.object;
            while (o && o !== loaded.obj) {
              if (pickable.has(o.name) && loaded.meshes.has(o.name)) return { key: item.key, partId: o.name };
              o = o.parent;
            }
            if (o === loaded.obj) return null;
          }
        }
        return null;
      };

      const clearHover = () => {
        if (!hovered) return;
        for (const s of hovered.saved) {
          s.mat.emissive.copy(s.color);
          s.mat.emissiveIntensity = s.intensity;
        }
        hovered = null;
        el.classList.remove("is-wskazuje");
      };

      const setHover = (hit: Hit | null) => {
        if (hovered && hit && hovered.hit.key === hit.key && hovered.hit.partId === hit.partId) return;
        clearHover();
        if (hit) {
          const mesh = rt.current?.loaded.get(hit.key)?.meshes.get(hit.partId);
          const mat = mesh?.material as T.MeshStandardMaterial | undefined;
          if (mat?.emissive) {
            const accent = token("--akcent");
            const saved = [{ mat, color: mat.emissive.clone(), intensity: mat.emissiveIntensity }];
            if (accent) mat.emissive.set(accent);
            mat.emissiveIntensity = 0.35;
            hovered = { hit, saved };
            el.classList.add("is-wskazuje");
          }
        }
        kick();
      };

      let down: { x: number; y: number } | null = null;
      const onDown = (e: PointerEvent) => {
        down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
      };
      const onUp = (e: PointerEvent) => {
        if (!down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        down = null;
        if (moved > 5) return;
        const hit = hitAt(e.clientX, e.clientY);
        if (hit) pick.current?.(hit.key, hit.partId);
      };
      let moveRaf = 0;
      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" || e.buttons !== 0 || dragging) return;
        const { clientX, clientY } = e;
        cancelAnimationFrame(moveRaf);
        moveRaf = requestAnimationFrame(() => setHover(hitAt(clientX, clientY)));
      };
      const onLeave = () => {
        cancelAnimationFrame(moveRaf);
        if (hovered) {
          clearHover();
          kick();
        }
      };
      const canvas = renderer.domElement;
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);

      cleanup = () => {
        cancelAnimationFrame(raf);
        cancelAnimationFrame(moveRaf);
        canvas.removeEventListener("pointerdown", onDown);
        canvas.removeEventListener("pointerup", onUp);
        canvas.removeEventListener("pointermove", onMove);
        canvas.removeEventListener("pointerleave", onLeave);
        ro.disconnect();
        controls.dispose();
        draco.dispose();
        scene.environment?.dispose();
        scene.traverse((o) => {
          const m = (o as T.Mesh).material as T.Material | T.Material[] | undefined;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m?.dispose();
          (o as T.Mesh).geometry?.dispose();
        });
        sun.shadow.map?.dispose();
        renderer.dispose();
        canvas.remove();
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
        goTo,
        poseFor: (dir, rot) => poseFor(dir, rot),
        aimRot: () => tween?.to.rot ?? group.rotation.y,
        clearHover,
      };
      // Kierunki widokow z katow (uzywane przez uchwyt).
      viewDirs.current = {
        front: dirFrom(VIEWS.front.az, VIEWS.front.el),
        top: dirFrom(VIEWS.top.az, VIEWS.top.el),
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

  const viewDirs = useRef<Record<"front" | "top", T.Vector3> | null>(null);

  // Sklad sceny: ladowanie tylko zmienionych elementow (inny model albo inne przesuniecie pod danym kluczem).
  const layoutKey = items.map((i) => `${i.key}:${i.model.id}:${i.offset.join(",")}`).join("|");
  useEffect(() => {
    const r = rt.current;
    if (!r || !sceneReady) return;
    let cancelled = false;
    status.current?.("loading");
    const wanted = itemsRef.current;
    r.clearHover();

    let removed = false;
    for (const [key, l] of r.loaded) {
      const w = wanted.find((i) => i.key === key);
      if (!w || w.model.id !== l.modelId) {
        r.group.remove(l.obj);
        r.loaded.delete(key);
        removed = true;
      }
    }

    (async () => {
      let changed = removed;
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
          const obj = gltf.scene;
          obj.position.set(...item.offset);
          const meshes = new Map<string, T.Mesh>();
          obj.traverse((o) => {
            if ((o as T.Mesh).isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              meshes.set(o.name, o as T.Mesh);
            }
          });
          r.group.add(obj);
          r.loaded.set(item.key, { modelId: item.model.id, offsetKey, obj, meshes });
          changed = true;
        }),
      );
      if (cancelled) return;
      if (changed) r.frame(true);
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
    r.clearHover();

    for (const item of items) {
      const loaded = r.loaded.get(item.key);
      if (!loaded || loaded.modelId !== item.model.id) continue;
      for (const [partId, mesh] of loaded.meshes) {
        const paint = partPaint(data, item.config, partId);
        if (!paint) continue;
        const old = mesh.material as T.Material;
        const mat = new THREE.MeshPhysicalMaterial(
          paint.pbr as unknown as T.MeshPhysicalMaterialParameters,
        );
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
          const mat = top.material as T.MeshPhysicalMaterial;
          mat.map = tex;
          mat.color.copy(new THREE.Color(1, 1, 1));
          mat.needsUpdate = true;
          r.render();
        });
      }
    }
    r.render();
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
        const rot = r.aimRot() + (deg * Math.PI) / 180;
        // Obrot bryly przy tym samym ustawieniu kamery; kadr liczony dla nowego obrotu.
        const dir = r.camera.position.clone().sub(r.controls.target);
        r.goTo(r.poseFor(dir, rot));
      },
      view(v) {
        const r = rt.current;
        const dir = viewDirs.current?.[v];
        if (!r || !dir) return;
        // Najkrotsza droga do obrotu 0 (bez kilku pelnych obrotow po wielu kliknieciach).
        const full = Math.PI * 2;
        const cur = r.group.rotation.y;
        r.group.rotation.y = ((((cur + Math.PI) % full) + full) % full) - Math.PI;
        r.goTo(r.poseFor(dir.clone(), 0));
      },
    }),
    [],
  );

  return <div ref={host} className="konfigurator__scena-plotno" />;
}
