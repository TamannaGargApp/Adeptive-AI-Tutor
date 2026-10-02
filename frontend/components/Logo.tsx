import Image from "next/image";

// Intrinsic size of /logo.png — used to derive width from a target height so the mark never stretches.
const LOGO_WIDTH = 1815;
const LOGO_HEIGHT = 866;

export function LogoMark({ height = 32 }: { height?: number }) {
  const width = Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT);
  return (
    <Image
      src="/logo.png"
      alt="Adaptive AI Tutor"
      width={width}
      height={height}
      priority
    />
  );
}

export default function Logo({ height = 32 }: { height?: number }) {
  return <LogoMark height={height} />;
}
