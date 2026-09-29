"use client";

import { useEffect, useRef } from "react";

const SIZE = 64;
const COLORS = ["#007c70", "#1737d7", "#7b14ed", "#dd19e9", "#f06ca8", "#ffdc58", "#c8c5ee"];

type Spark = { x: number; y: number; width: number; height: number; phase: number };

const SPARKS: Spark[] = [
  { x: 39, y: 31, width: 21, height: 29, phase: 0 },
  { x: 13, y: 15, width: 8, height: 14, phase: 1.8 },
  { x: 18, y: 49, width: 8, height: 12, phase: 3.5 },
];

function spectrumColor(position: number) {
  const wrapped = ((position % 1) + 1) % 1;
  const index = wrapped * COLORS.length;
  const first = COLORS[Math.floor(index)];
  const second = COLORS[(Math.floor(index) + 1) % COLORS.length];
  const mix = index - Math.floor(index);
  const channel = (offset: number) => {
    const from = parseInt(first.slice(offset, offset + 2), 16);
    const to = parseInt(second.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * mix);
  };
  return `rgb(${channel(1)} ${channel(3)} ${channel(5)})`;
}

function traceSpark(context: CanvasRenderingContext2D, width: number, height: number) {
  // Concave curves make the four tapered rays meet in a soft, luminous core.
  context.beginPath();
  context.moveTo(0, -height);
  context.bezierCurveTo(width * 0.13, -height * 0.22, width * 0.22, -height * 0.13, width, 0);
  context.bezierCurveTo(width * 0.22, height * 0.13, width * 0.13, height * 0.22, 0, height);
  context.bezierCurveTo(-width * 0.13, height * 0.22, -width * 0.22, height * 0.13, -width, 0);
  context.bezierCurveTo(-width * 0.22, -height * 0.13, -width * 0.13, -height * 0.22, 0, -height);
  context.closePath();
}

function paintSpark(context: CanvasRenderingContext2D, spark: Spark, time: number) {
  const breath = 1 + Math.sin(time * 2.1 + spark.phase) * 0.055;
  const colorPhase = time * 0.12 + spark.phase * 0.07;
  context.save();
  context.translate(spark.x, spark.y);
  context.scale(breath, breath);
  traceSpark(context, spark.width, spark.height);

  const gradient = context.createLinearGradient(-spark.width, -spark.height, spark.width, spark.height);
  for (let index = 0; index <= 3; index += 1) {
    gradient.addColorStop(index / 3, spectrumColor(colorPhase + index * 0.11));
  }
  context.fillStyle = gradient;
  context.shadowColor = "rgba(167, 74, 255, 0.62)";
  context.shadowBlur = spark.width > 10 ? 10 : 6;
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255, 255, 255, 0.58)";
  context.lineWidth = 0.65;
  context.stroke();

  // A moving highlight gives the gradient a glint without changing the silhouette.
  const highlight = context.createRadialGradient(
    Math.sin(time * 1.2 + spark.phase) * spark.width * 0.38,
    -spark.height * 0.14,
    0,
    0,
    0,
    spark.width * 0.88,
  );
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.78)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = highlight;
  context.fill();
  context.restore();
}

export function LightframeThinkingOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(SIZE * dpr);
    canvas.height = Math.round(SIZE * dpr);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = true;
    let isRunning = false;
    let animationFrame = 0;

    const paint = (time: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, SIZE, SIZE);
      for (const spark of SPARKS) paintSpark(context, spark, time);
    };

    const stop = () => {
      isRunning = false;
      window.cancelAnimationFrame(animationFrame);
    };

    const loop = () => {
      paint(performance.now() / 1000);
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
    paint(reducedMotion.matches ? 0.6 : performance.now() / 1000);
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
      <canvas ref={canvasRef} className="lightframe-thinking-orb" width={SIZE} height={SIZE} />
    </span>
  );
}
