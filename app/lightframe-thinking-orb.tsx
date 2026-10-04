"use client";

import { useEffect, useRef } from "react";

const SIZE = 64;
const COLORS = ["#007c70", "#1737d7", "#7b14ed", "#dd19e9", "#f06ca8", "#ffdc58", "#c8c5ee"];
const RGB_COLORS = COLORS.map((color) => [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)));
const GRADIENT_STEPS = 32;
const GRADIENT_CYCLES_PER_SECOND = 0.22;
const VISIBLE_SPECTRUM = 0.78;
const fraction = (value: number) => value - Math.floor(value);
const TEXTURE_POINTS = Array.from({ length: 130 }, (_, index) => ({
  x: fraction(Math.sin(index * 127.1 + 4.7) * 43758.5453) * SIZE,
  y: fraction(Math.sin(index * 311.7 + 8.3) * 22578.1459) * SIZE,
  radius: index % 9 === 0 ? 1.05 : 0.68,
  light: index % 3 !== 0,
}));

type Spark = { x: number; y: number; width: number; height: number; phase: number };

const SPARKS: Spark[] = [
  { x: 39, y: 31, width: 21, height: 29, phase: 0 },
  { x: 13, y: 15, width: 8, height: 14, phase: 1.8 },
  { x: 18, y: 49, width: 8, height: 12, phase: 3.5 },
];

function spectrumColor(position: number) {
  const wrapped = ((position % 1) + 1) % 1;
  const scaled = wrapped * RGB_COLORS.length;
  const start = Math.floor(scaled);
  const blend = scaled - start;
  const from = RGB_COLORS[start];
  const to = RGB_COLORS[(start + 1) % RGB_COLORS.length];
  return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * blend)).join(" ")})`;
}

function traceSpark(context: CanvasRenderingContext2D, spark: Spark, time: number) {
  // Concave curves make the four tapered rays meet in a soft, luminous core.
  const breath = 1 + Math.sin(time * 2.1 + spark.phase) * 0.055;
  const width = spark.width * breath;
  const height = spark.height * breath;
  const { x, y } = spark;
  context.moveTo(x, y - height);
  context.bezierCurveTo(x + width * 0.13, y - height * 0.22, x + width * 0.22, y - height * 0.13, x + width, y);
  context.bezierCurveTo(x + width * 0.22, y + height * 0.13, x + width * 0.13, y + height * 0.22, x, y + height);
  context.bezierCurveTo(x - width * 0.13, y + height * 0.22, x - width * 0.22, y + height * 0.13, x - width, y);
  context.bezierCurveTo(x - width * 0.22, y - height * 0.13, x - width * 0.13, y - height * 0.22, x, y - height);
  context.closePath();
}

function paintSparks(context: CanvasRenderingContext2D, time: number) {
  // One diagonal field spans all three sparks. Less than one palette cycle is
  // visible at once, so no hue appears as a second, disconnected band.
  const gradient = context.createLinearGradient(6, 58, 60, 6);
  const phase = time * GRADIENT_CYCLES_PER_SECOND;
  for (let index = 0; index <= GRADIENT_STEPS; index += 1) {
    const stop = index / GRADIENT_STEPS;
    gradient.addColorStop(stop, spectrumColor(stop * VISIBLE_SPECTRUM - phase));
  }
  context.beginPath();
  for (const spark of SPARKS) traceSpark(context, spark, time);
  context.fillStyle = gradient;
  context.shadowColor = COLORS[3];
  context.shadowBlur = 8;
  context.fill();

  // Clip the light and fine grain to the filled silhouettes: dimension without
  // restoring the bright outline that made the stars look flat and sticker-like.
  context.save();
  context.shadowBlur = 0;
  context.clip();

  const sheen = context.createRadialGradient(35, 23, 1, 39, 32, 24);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.48)");
  sheen.addColorStop(0.38, "rgba(255, 255, 255, 0.18)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = sheen;
  context.fillRect(0, 0, SIZE, SIZE);

  const depth = context.createLinearGradient(19, 8, 52, 55);
  depth.addColorStop(0, "rgba(255, 255, 255, 0.13)");
  depth.addColorStop(0.48, "rgba(0, 0, 0, 0)");
  depth.addColorStop(1, "rgba(5, 7, 25, 0.3)");
  context.fillStyle = depth;
  context.fillRect(0, 0, SIZE, SIZE);

  const satin = context.createLinearGradient(17, 58, 53, 5);
  satin.addColorStop(0, "rgba(255, 255, 255, 0)");
  satin.addColorStop(0.36, "rgba(255, 255, 255, 0.01)");
  satin.addColorStop(0.52, "rgba(255, 255, 255, 0.25)");
  satin.addColorStop(0.68, "rgba(255, 255, 255, 0)");
  satin.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = satin;
  context.fillRect(0, 0, SIZE, SIZE);

  // A broad inner facet survives the 36px display size, unlike sub-pixel grain.
  context.beginPath();
  context.moveTo(39, 8);
  context.bezierCurveTo(38, 20, 36, 27, 39, 31);
  context.bezierCurveTo(35, 31, 32, 29, 30, 26);
  context.bezierCurveTo(35, 24, 38, 15, 39, 8);
  context.closePath();
  const facet = context.createLinearGradient(30, 11, 41, 32);
  facet.addColorStop(0, "rgba(255, 255, 255, 0.04)");
  facet.addColorStop(0.65, "rgba(255, 255, 255, 0.26)");
  facet.addColorStop(1, "rgba(255, 255, 255, 0.05)");
  context.fillStyle = facet;
  context.fill();

  context.beginPath();
  context.moveTo(39, 31);
  context.bezierCurveTo(45, 32, 49, 31, 54, 31);
  context.bezierCurveTo(46, 35, 41, 44, 39, 54);
  context.closePath();
  context.fillStyle = "rgba(8, 11, 33, 0.13)";
  context.fill();

  for (const point of TEXTURE_POINTS) {
    context.fillStyle = point.light
      ? "rgba(255, 255, 255, 0.2)"
      : "rgba(6, 8, 24, 0.16)";
    context.beginPath();
    context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    context.fill();
  }
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
      paintSparks(context, time);
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
