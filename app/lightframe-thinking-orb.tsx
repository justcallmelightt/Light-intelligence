"use client";

import { useEffect, useRef } from "react";
import { MODE_DRAWS, resolvePreset } from "thinking-orbs";

const SIZE = 64;

// Keep these stops aligned with the spectrum used by Lightframe.'s banner.
const LIGHTFRAME_SPECTRUM = [
  [0, "#007c70"],
  [0.22, "#1737d7"],
  [0.4, "#7b14ed"],
  [0.55, "#dd19e9"],
  [0.69, "#f06ca8"],
  [0.84, "#ffdc58"],
  [1, "#c8c5ee"],
] as const;

export function LightframeThinkingOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);

    const { mode, speed, opts } = resolvePreset("working", SIZE);
    const gradient = context.createLinearGradient(0, 0, SIZE, SIZE * 0.18);
    for (const [stop, color] of LIGHTFRAME_SPECTRUM) {
      gradient.addColorStop(stop, color);
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = true;
    let isRunning = false;
    let animationFrame = 0;

    const paint = (time: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, SIZE, SIZE);

      MODE_DRAWS[mode](context, SIZE, time, true, opts);
      context.globalCompositeOperation = "source-in";
      context.fillStyle = gradient;
      context.fillRect(0, 0, SIZE, SIZE);
      context.globalCompositeOperation = "source-over";

      // The stock orb's subtle alpha needs more presence once spread across
      // seven brand colors, especially against the real-black chat canvas.
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let index = 3; index < pixels.data.length; index += 4) {
        pixels.data[index] = Math.min(255, pixels.data[index] * 3.2);
      }
      context.putImageData(pixels, 0, 0);
    };

    const stop = () => {
      isRunning = false;
      window.cancelAnimationFrame(animationFrame);
    };

    const loop = () => {
      paint((performance.now() / 1000) * speed);
      if (isRunning) animationFrame = window.requestAnimationFrame(loop);
    };

    const start = () => {
      if (isRunning || !isVisible || document.hidden || reducedMotion.matches) return;
      isRunning = true;
      animationFrame = window.requestAnimationFrame(loop);
    };

    const syncMotion = () => {
      stop();
      if (reducedMotion.matches) paint(0.6);
      else start();
    };

    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible) start();
          else stop();
        });

    observer?.observe(canvas);
    reducedMotion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncMotion);
    paint(reducedMotion.matches ? 0.6 : (performance.now() / 1000) * speed);
    start();

    return () => {
      stop();
      observer?.disconnect();
      reducedMotion.removeEventListener("change", syncMotion);
      document.removeEventListener("visibilitychange", syncMotion);
    };
  }, []);

  return (
    <span className="lightframe-thinking-orb-shell" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="lightframe-thinking-orb"
        width={SIZE}
        height={SIZE}
      />
    </span>
  );
}
