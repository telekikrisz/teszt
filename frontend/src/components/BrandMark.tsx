type BrandMarkProps = {
  subtitle?: string;
  variant?: "sidebar" | "login";
};

export function BrandMark({ subtitle, variant = "sidebar" }: BrandMarkProps) {
  const isLogin = variant === "login";

  if (isLogin) {
    return (
      <div className="mx-auto flex w-fit flex-col items-center">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/cimer.png?v=2"
            alt=""
            className="h-14 w-14 shrink-0 object-contain drop-shadow-md"
          />
          <div
            className="font-display text-5xl font-semibold leading-tight text-white drop-shadow-lg"
          >
            TelekiTeszt
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center px-2">
      <div className="flex items-center gap-2.5">
        <img
          src="/cimer.png?v=2"
          alt=""
          className="h-9 w-9 shrink-0 object-contain drop-shadow-sm"
        />
        <div className="flex flex-col items-center text-center">
          <div
            className="font-display text-2xl font-semibold leading-tight"
            style={{ color: "#f4faf6", textShadow: "0 1px 4px rgba(0,0,0,0.45)" }}
          >
            TelekiTeszt
          </div>
          {subtitle ? (
            <div
              className="mt-1 text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: "rgba(244,250,246,0.72)", textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
