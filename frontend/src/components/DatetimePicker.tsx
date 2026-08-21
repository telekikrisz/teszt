import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { VIZSGA_IDOABLAK_MIN_PERC, validateVizsgaIdoablak } from "@oktateszt/shared";

/** @deprecated használd a VIZSGA_IDOABLAK_MIN_PERC-et */
export const MIN_IDOABLAK_PERC = VIZSGA_IDOABLAK_MIN_PERC;

const timeInputClass =
  "shrink-0 rounded-md border border-rule bg-white px-1.5 py-2 text-center text-base font-semibold tabular-nums text-navy outline-none focus:border-clay";

const hourInputClass = `${timeInputClass} w-[3.25rem] min-w-[3.25rem]`;
const minuteInputClass = `${timeInputClass} w-[4.5rem] min-w-[4.5rem]`;

function parseDatetimeLocal(value: string) {
  if (!value) return { date: "", hour: "", minute: "" };
  const [date, time] = value.split("T");
  const [hour = "", minute = ""] = (time ?? "").split(":");
  return { date: date ?? "", hour, minute };
}

function buildDatetimeLocal(date: string, hour: string, minute: string) {
  if (!date || hour === "" || minute === "") return "";
  const h = String(Number(hour)).padStart(2, "0");
  const m = String(Number(minute)).padStart(2, "0");
  if (Number.isNaN(Number(h)) || Number.isNaN(Number(m))) return "";
  return `${date}T${h}:${m}`;
}

function digitsOnly(raw: string, maxLen = 2) {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

/** Csak 0..max közötti (részleges) számjegy-bevitel; érvénytelen jegyeket elutasítja. */
function constrainTimeDigits(raw: string, max: number) {
  const digits = digitsOnly(raw, 2);
  if (digits === "") return "";
  if (Number(digits) > max) return null;
  return digits;
}

function parseTimePart(raw: string, max: number): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > max) return null;
  return n;
}

function displayTimePart(n: number) {
  return String(n).padStart(2, "0");
}

type DatetimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  idPrefix?: string;
};

/**
 * Dátum + óra:perc. Gépelés közben nem validál és nem ugrik tovább;
 * commit blur/Enter esetén. A kétjegyű beírás sima szövegmezőként működik.
 */
export function DatetimePicker({ value, onChange, onComplete, idPrefix = "dt" }: DatetimePickerProps) {
  const parsed = parseDatetimeLocal(value);
  const [date, setDate] = useState(parsed.date);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const skipSync = useRef(false);

  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    const p = parseDatetimeLocal(value);
    setDate(p.date);
    setHour(p.hour);
    setMinute(p.minute);
  }, [value]);

  function emit(nextDate: string, nextHour: string, nextMinute: string) {
    const built = buildDatetimeLocal(nextDate, nextHour, nextMinute);
    if (built) {
      skipSync.current = true;
      onChange(built);
    }
  }

  function commitHour(rawHour: string, rawMinute: string, focusMinute = false) {
    const h = parseTimePart(rawHour, 23);
    if (h === null) return;
    setHour(displayTimePart(h));
    const m = parseTimePart(rawMinute, 59);
    if (m !== null && date) emit(date, String(h), String(m));
    if (focusMinute) minuteRef.current?.focus();
  }

  function commitMinute(rawHour: string, rawMinute: string, complete = false) {
    const h = parseTimePart(rawHour, 23);
    const m = parseTimePart(rawMinute, 59);
    if (h === null || m === null || !date) return;
    setMinute(displayTimePart(m));
    emit(date, String(h), String(m));
    if (complete) onComplete?.();
  }

  return (
    <div className="inline-flex max-w-full flex-nowrap items-center gap-1.5">
      <input
        id={`${idPrefix}-date`}
        type="date"
        value={date}
        onChange={(e) => {
          const next = e.target.value;
          setDate(next);
          emit(next, hour, minute);
          if (next) hourRef.current?.focus();
        }}
        className="w-[7.25rem] shrink-0 rounded-md border border-rule bg-white px-1.5 py-2 text-sm text-navy outline-none focus:border-clay"
        required
      />
      <input
        ref={hourRef}
        id={`${idPrefix}-hour`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="óó"
        value={hour}
        onChange={(e) => {
          const next = constrainTimeDigits(e.target.value, 23);
          if (next !== null) setHour(next);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          if (hour !== "") commitHour(hour, minute);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && hour !== "") {
            e.preventDefault();
            commitHour(hour, minute, true);
          }
        }}
        className={hourInputClass}
        required
      />
      <span className="shrink-0 text-base font-semibold text-navy/50">:</span>
      <input
        ref={minuteRef}
        id={`${idPrefix}-min`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        placeholder="pp"
        value={minute}
        onChange={(e) => {
          const next = constrainTimeDigits(e.target.value, 59);
          if (next !== null) setMinute(next);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          if (minute !== "") commitMinute(hour, minute, false);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" && minute !== "") {
            e.preventDefault();
            commitMinute(hour, minute, true);
          }
        }}
        className={minuteInputClass}
        required
      />
    </div>
  );
}

export function validateIdoablak(eleje: string, vege: string): string | null {
  if (!eleje || !vege) return null;
  const start = new Date(eleje);
  const end = new Date(vege);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Érvénytelen dátum vagy idő.";
  }
  return validateVizsgaIdoablak(start, end)?.message ?? null;
}
