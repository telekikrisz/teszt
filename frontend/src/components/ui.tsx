import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary:
      "border border-clay-dark/25 bg-gradient-to-b from-clay to-clay-dark text-white shadow-sm hover:from-clay-dark hover:to-[#7a3510] hover:shadow",
    secondary:
      "border border-navy-deep/30 bg-gradient-to-b from-navy to-navy-deep text-white shadow-sm hover:from-navy-deep hover:to-[#0d1a26] hover:shadow",
    ghost:
      "border border-rule bg-gradient-to-b from-white to-paper-2 text-navy shadow-sm hover:from-paper-2 hover:to-[#ddd5c8] hover:shadow",
    danger:
      "border border-red-950/30 bg-gradient-to-b from-red-700 to-red-900 text-white shadow-sm hover:from-red-800 hover:to-red-950 hover:shadow",
  } as const;
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-clay ${className}`}
      {...props}
    />
  );
}

export function NumberInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      className={`rounded-md border border-rule bg-paper px-4 py-2.5 text-sm font-semibold tabular-nums text-navy outline-none focus:border-clay focus:bg-white [appearance:auto] ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-md border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-clay ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full cursor-pointer appearance-none rounded-md border border-rule bg-paper bg-[length:1rem] bg-[position:right_0.75rem_center] bg-no-repeat py-2 pl-3 pr-10 text-sm outline-none focus:border-clay ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
      }}
      {...props}
    />
  );
}

export function WrapSelect({
  value,
  onChange,
  disabled,
  required,
  placeholder,
  options,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={`relative flex w-full min-h-10 cursor-pointer items-center rounded-md border border-rule bg-paper pr-10 pl-3 py-2 text-left text-sm outline-none focus:border-clay disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? "border-clay ring-1 ring-clay/30" : ""
        }`}
      >
        <span className="whitespace-normal break-words leading-snug">
          {selected?.label ?? placeholder}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {required ? <input tabIndex={-1} aria-hidden className="sr-only" value={value} required onChange={() => {}} /> : null}
      {open && !disabled ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-rule bg-white py-1 shadow-lg"
        >
          <li role="option" aria-selected={value === ""}>
            <button
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm whitespace-normal break-words leading-snug hover:bg-paper-2 ${
                value === "" ? "bg-paper-2 font-medium" : ""
              }`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
          </li>
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={value === option.value}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm whitespace-normal break-words leading-snug hover:bg-paper-2 ${
                  value === option.value ? "bg-paper-2 font-medium" : ""
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-navy/70">{label}</span>
      {children}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-rule bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl text-navy">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink/70">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | "aktiv" | "archiv" | "agazat" | "tantargy" | "temakor";
  className?: string;
}) {
  const tones = {
    neutral: "bg-paper-2 text-navy",
    good: "bg-moss/15 text-moss",
    warn: "bg-amber-100 text-amber-900",
    bad: "bg-red-100 text-red-800",
    info: "bg-sky-100 text-sky-900",
    aktiv: "bg-moss/15 text-moss ring-1 ring-moss/25",
    archiv: "bg-amber-100 text-amber-900 ring-1 ring-amber-300/60",
    agazat: "bg-[#dce8e0] text-[#1a3d2f]",
    tantargy: "bg-[#dbeafe] text-[#1e3a5f]",
    temakor: "bg-[#ede9fe] text-[#5b21b6]",
  };
  return (
    <span
      className={`inline-flex max-w-full rounded-md px-2.5 py-1 text-xs font-semibold leading-snug ${tones[tone]} ${className}`}
    >
      <span className="break-words">{children}</span>
    </span>
  );
}

export function Modal({
  title,
  children,
  onClose,
  theme = "default",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  theme?: "default" | "tanar";
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const overlayClass =
    theme === "tanar"
      ? "fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center bg-[rgba(30,61,47,0.45)]"
      : "fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center";

  const panelClass =
    theme === "tanar"
      ? "max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--color-sage-border)] p-5 shadow-xl"
      : "max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-paper p-5 shadow-xl";

  const panelStyle =
    theme === "tanar"
      ? {
          background: "linear-gradient(165deg, #ffffff 0%, #f6faf7 38%, #eef4ef 100%)",
        }
      : undefined;

  const content = (
    <div className={overlayClass} onClick={onClose}>
      <div
        className={panelClass}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="font-display text-xl text-navy">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-sm text-navy/60 hover:text-navy">
            Bezárás
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return createPortal(theme === "tanar" ? <div className="tanar-shell">{content}</div> : content, document.body);
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Hiba történt.";
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/60">{children}</p>;
}

export function statusTone(status: string) {
  if (status === "PUBLISHED") return "good" as const;
  if (status === "DRAFT") return "warn" as const;
  if (status === "CLOSED") return "info" as const;
  return "neutral" as const;
}
