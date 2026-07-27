import { cn } from "@/lib/utils";

interface SearchCircularLoaderProps {
  size?: number;
  className?: string;
}

export default function SearchCircularLoader({ size = 18, className }: SearchCircularLoaderProps) {
  const stroke = Math.max(1.5, size * 0.11);
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const half = c / 2;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      {/* Outer ring — fast sweep */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 animate-[spin_0.7s_linear_infinite]"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${half} ${half}`}
          className="text-primary"
        />
      </svg>
      {/* Inner ring — counter-rotate for depth */}
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox={`0 0 ${size * 0.6} ${size * 0.6}`}
        className="absolute inset-0 m-auto animate-[spin_1s_linear_infinite_reverse]"
      >
        <circle
          cx={(size * 0.6) / 2}
          cy={(size * 0.6) / 2}
          r={(size * 0.6 - stroke * 2) / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={Math.max(1, stroke * 0.7)}
          strokeLinecap="round"
          strokeDasharray={`${half * 0.4} ${half * 0.6}`}
          className="text-primary/50"
        />
      </svg>
      {/* Center dot */}
      <div
        className="rounded-full bg-primary animate-pulse"
        style={{ width: size * 0.18, height: size * 0.18 }}
      />
    </div>
  );
}
