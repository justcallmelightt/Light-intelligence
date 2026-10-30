"use client";

import { useEffect, useRef } from "react";
import { accentChain, createShader, playSweep } from "glimm";

const lightframePalette = accentChain([
  "#008254",
  "#0101d9",
  "#8100ff",
  "#e934f7",
  "#f6de5c",
]);

export function PrismComposerSweep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The reference component pins the shader's initial hue phase so each run
    // starts from the same palette position. createShader is synchronous.
    const random = Math.random;
    let shader: ReturnType<typeof createShader>;
    try {
      Math.random = () => 0;
      shader = createShader({
        canvas,
        palette: lightframePalette,
        direction: "ltr",
        bandTight: 10,
        swellAmount: 0.85,
      });
    } finally {
      Math.random = random;
    }
    if (!shader) return;

    const sweep = playSweep(shader, {
      palette: lightframePalette,
      direction: "ltr",
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: "easeOutExpo",
    });

    return () => {
      sweep.cancel();
      shader.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="composer-prism-canvas" aria-hidden="true" />;
}
