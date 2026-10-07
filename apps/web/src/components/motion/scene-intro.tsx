"use client";
// A-02 (docs/07 §3.2): obudowa DeskStage w pierwszym ekranie. Raz na sesje dodaje klase `scena-start` (po zgloszeniu
// widocznosci przez IntersectionObserver). Pierwsza klatka jest zawsze stanem koncowym (LCP): bez klasy nic sie nie
// rusza, a sama sekwencja to przesuniecia (strefa i plakietka dodatkowo opacity). Uzycie: <SceneIntro><DeskStage/></SceneIntro>.
import type { ReactNode } from "react";
import { useSceneStart } from "../../lib/motion/scene-start";

export function SceneIntro({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, active, onAnimationEnd } = useSceneStart<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={[className, active ? "scena-start" : null].filter(Boolean).join(" ") || undefined}
      onAnimationEnd={onAnimationEnd}
    >
      {children}
    </div>
  );
}
