import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  /** Path to logo image shown centered and static */
  logoSrc?: string;
  /** Alt text for the logo */
  logoAlt?: string;
  /** Optional message below the loader */
  message?: string;
  className?: string;
}

const SPOKE_COUNT = 8;
const RADIUS = 52;

/**
 * Full-screen loading screen.
 *
 * - Static circular logo in the center
 * - Radial spoke / petal spinner around the logo
 * - Supports light / dark via Tailwind `dark:` variants
 * - Spokes use `currentColor` so accent colour is inherited from parent
 *
 * Usage:
 *   <LoadingScreen />                                 // default logo path
 *   <LoadingScreen logoSrc="/logo.svg" message="…" /> // custom
 */
export default function LoadingScreen({
  logoSrc = "/msf_logo.jpg",
  logoAlt = "MSF",
  message,
  className,
}: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-300",
        className,
      )}
    >
      {/* Loader wrapper — fixed size, holds logo + spinning spokes */}
      <div className="relative" style={{ width: RADIUS * 2 + 24, height: RADIUS * 2 + 24 }}>
        {/* ── Static circular logo ────────────────── */}
        <img
          src={logoSrc}
          alt={logoAlt}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full object-cover shadow-lg select-none"
          draggable={false}
        />

        {/* ── Spinning petal / spoke ring ──────────── */}
        <div
          className="absolute inset-0 animate-[loader-spin_1.6s_linear_infinite]"
          style={{ willChange: "transform" }}
        >
          {Array.from({ length: SPOKE_COUNT }).map((_, i) => {
            const angle = (360 / SPOKE_COUNT) * i;
            const progress = i / SPOKE_COUNT;
            const opacity = 1 - progress * 0.85;
            const scaleY = 1 - progress * 0.3;
            return (
              <span
                key={i}
                className="absolute left-1/2 top-1/2 block rounded-full bg-primary"
                style={{
                  width: 2.5,
                  height: 14,
                  marginLeft: -1.25,
                  marginTop: -7,
                  opacity,
                  transform: `rotate(${angle}deg) translateY(-${RADIUS}px) scaleY(${scaleY})`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Optional message */}
      {message && (
        <p className="mt-6 text-sm font-medium text-muted-foreground animate-pulse">
          {message}
        </p>
      )}

      {/* ── Keyframe injected once via <style> ─── */}
      <style>{`
        @keyframes loader-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
