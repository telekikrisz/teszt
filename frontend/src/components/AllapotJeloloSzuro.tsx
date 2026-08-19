import type { ReactNode } from "react";

type Jelolo = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type Csoport = {
  cim?: string;
  jelolok: Jelolo[];
};

function JeloloSor({ jelolok, compact }: { jelolok: Jelolo[]; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap ${compact ? "gap-x-3 gap-y-1" : "gap-x-4 gap-y-2"}`}>
      {jelolok.map((j) => (
        <label
          key={j.id}
          className={`flex items-center gap-2 text-ink/70 ${compact ? "text-xs" : "text-sm"}`}
        >
          <input
            type="checkbox"
            checked={j.checked}
            onChange={(e) => j.onChange(e.target.checked)}
            className="rounded border-rule"
          />
          {j.label}
        </label>
      ))}
    </div>
  );
}

export function AllapotJeloloSzuro({
  cim,
  jelolok,
  csoportok,
  children,
  compact,
}: {
  cim?: string;
  jelolok?: Jelolo[];
  csoportok?: Csoport[];
  children?: ReactNode;
  compact?: boolean;
}) {
  const csoportLista =
    csoportok ??
    (jelolok
      ? [{ jelolok }]
      : []);

  return (
    <div className={compact ? "space-y-1" : "mb-4 space-y-2"}>
      {cim ? <div className="text-xs font-semibold uppercase tracking-wide text-navy/70">{cim}</div> : null}
      <div className={`flex flex-wrap items-start ${compact ? "gap-x-3 gap-y-1" : "gap-x-5 gap-y-2"}`}>
        {csoportLista.map((csoport, index) => (
          <div key={csoport.cim ?? index} className="flex items-start gap-5">
            {index > 0 ? <div className="hidden h-full min-h-8 w-px self-stretch bg-rule sm:block" aria-hidden /> : null}
            <div className="space-y-1">
              {csoport.cim ? (
                <div className="text-xs font-semibold uppercase tracking-wide text-navy/70">{csoport.cim}</div>
              ) : null}
              <JeloloSor jelolok={csoport.jelolok} compact={compact} />
            </div>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export const ALAP_TARHELY_SZURO = { aktiv: true, archivalt: false } as const;

export const ALAP_TESZT_ALLAPOT_SZURO = {
  piszkozat: true,
  jovahagyott: true,
  aktiv: true,
  archivalt: false,
} as const;

export function tarhelyQuery(aktiv: boolean, archivalt: boolean) {
  const params = new URLSearchParams();
  if (aktiv) params.set("aktiv", "true");
  else params.set("aktiv", "false");
  if (archivalt) params.set("archivalt", "true");
  else params.set("archivalt", "false");
  return params.toString();
}

export function tesztAllapotQuery(szuro: {
  piszkozat: boolean;
  jovahagyott: boolean;
  aktiv: boolean;
  archivalt: boolean;
}) {
  const params = new URLSearchParams();
  params.set("piszkozat", szuro.piszkozat ? "true" : "false");
  params.set("jovahagyott", szuro.jovahagyott ? "true" : "false");
  params.set("aktiv", szuro.aktiv ? "true" : "false");
  params.set("archivalt", szuro.archivalt ? "true" : "false");
  return params.toString();
}
