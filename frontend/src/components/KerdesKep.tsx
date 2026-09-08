import { kerdesKepUrl } from "@oktateszt/shared";

export function KerdesKep({ fajl, className = "" }: { fajl: string | null | undefined; className?: string }) {
  const src = kerdesKepUrl(fajl);
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      className={`mt-3 block h-auto w-auto max-h-[min(70vh,32rem)] max-w-full object-contain ${className}`}
    />
  );
}
