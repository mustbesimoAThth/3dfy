import Image from "next/image";

type BrandMarkSize = "sm" | "md" | "lg";

type BrandMarkProps = {
  className?: string;
  size?: BrandMarkSize;
  /** When true, mark is decorative (sits next to a visible "3dfy" label). */
  decorative?: boolean;
  /** Override the priority hint on the underlying next/image. */
  priority?: boolean;
};

// Tailwind-safe explicit classes so the JIT picks them up.
const HEIGHT: Record<BrandMarkSize, string> = {
  sm: "h-6 sm:h-7",
  md: "h-7 sm:h-8",
  lg: "h-10 sm:h-12",
};

const PADDING: Record<BrandMarkSize, string> = {
  sm: "px-2 py-1",
  md: "px-2.5 py-1.5",
  lg: "px-3 py-2",
};

/**
 * 3dfy wordmark on a black rounded tile.
 *
 * The source PNG has a hard black background; wrapping it in a black tile
 * lets the glassy cyan wordmark read cleanly on the app's light surfaces
 * without needing blend-mode tricks (which wash out the colour).
 */
export function BrandMark({
  className = "",
  size = "md",
  decorative = false,
  priority = false,
}: BrandMarkProps) {
  return (
    <span
      className={
        "inline-flex items-center rounded-xl bg-black shadow-sm ring-1 ring-black/30 " +
        PADDING[size] +
        " " +
        className
      }
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        src="/brand/3dfy_logo.png"
        alt={decorative ? "" : "3dfy"}
        width={1536}
        height={1024}
        priority={priority}
        className={`w-auto ${HEIGHT[size]}`}
      />
    </span>
  );
}
