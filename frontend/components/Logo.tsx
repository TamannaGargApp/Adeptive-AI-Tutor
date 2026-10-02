import Image from "next/image";

// Intrinsic size of /logo.png and /logo-dark.png — used to derive width from a target height
// so the mark never stretches.
const LOGO_WIDTH = 1815;
const LOGO_HEIGHT = 866;

export function LogoMark({ height = 32 }: { height?: number }) {
  const width = Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT);
  return (
    <span className="relative inline-block" style={{ width, height }}>
      {/* Visibility is toggled in globals.css by the same selectors that drive the color theme,
          so the right mark is shown pre-paint with no flash, in both System and explicit modes. */}
      <Image src="/logo.png" alt="Adaptive AI Tutor" width={width} height={height} priority className="logo-light-mark" />
      <Image
        src="/logo-dark.png"
        alt="Adaptive AI Tutor"
        width={width}
        height={height}
        priority
        className="logo-dark-mark absolute inset-0"
      />
    </span>
  );
}

export default function Logo({ height = 32 }: { height?: number }) {
  return <LogoMark height={height} />;
}
