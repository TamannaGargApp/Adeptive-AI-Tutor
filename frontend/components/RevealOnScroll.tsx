"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// What animates: cards and sections, plus anything marked data-reveal.
const TARGETS = ".panel, .card-lift, [data-reveal]";

/**
 * Animates sections into view as they scroll onto the screen, like a modern website.
 * Each one picks its movement from where it sits: cards on the left slide in from the left,
 * cards on the right from the right, full-width sections rise, and small tiles zoom in.
 * Sections that appear together are staggered slightly.
 *
 * Content is only hidden once this runs, so if JavaScript is off everything simply shows.
 * Nothing moves for people who prefer reduced motion.
 */
export default function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.querySelector("main");
    if (!main) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.style.setProperty("--reveal-delay", `${Math.min(order, 6) * 80}ms`);
          element.classList.add("is-visible");
          observer.unobserve(element);
          order++;
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );

    function variantFor(element: HTMLElement): string {
      const area = main!.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      if (!area.width || box.width > area.width * 0.7) return "reveal-up";
      if (box.width < area.width * 0.26) return "reveal-zoom";
      const center = (box.left + box.width / 2 - area.left) / area.width;
      if (center < 0.42) return "reveal-left";
      if (center > 0.58) return "reveal-right";
      return "reveal-up";
    }

    // Tracked per run (not on the element), so a second run of this effect (React runs effects
    // twice in development) picks up elements the first run hid but never got to show.
    const prepared = new WeakSet<HTMLElement>();

    function prepare(element: HTMLElement) {
      if (prepared.has(element) || element.classList.contains("is-visible")) return;
      prepared.add(element);
      // Sections nested inside an animating card move with it rather than on their own.
      if (element.parentElement?.closest(".reveal:not(.is-visible)")) return;
      if (!element.classList.contains("reveal")) element.classList.add("reveal", variantFor(element));
      observer.observe(element);
    }

    const scan = () => main.querySelectorAll<HTMLElement>(TARGETS).forEach(prepare);
    scan();
    // Pages load their data after the first render, so watch for new sections appearing.
    const mutations = new MutationObserver(scan);
    mutations.observe(main, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      observer.disconnect();
      // Never leave anything hidden: show whatever was still waiting to animate.
      main.querySelectorAll(".reveal:not(.is-visible)").forEach((element) => element.classList.add("is-visible"));
    };
  }, [pathname]);

  return null;
}
