import { useState, type ReactNode } from "react";
import { Button, Field, WrapSelect } from "./ui";
import { UjTemakorModal } from "./UjTemakorModal";
import { TemakorTorlesModal } from "./TemakorTorlesModal";

type Opt = { id: string; nev: string };

export function BankSzuro({
  evfolyamId,
  agazatId,
  tantargyId,
  temakorId,
  evfolyamok,
  agazatok,
  tantargyak,
  temakorok,
  onEvfolyam,
  onAgazat,
  onTantargy,
  onTemakor,
  onTemakorReload,
  onTemakorModalOpen,
  temakorUresFelirat = "Témazáró",
  kotelezo = false,
  ujTemakor = false,
  zaroltAgazat = false,
  zaroltTantargy = false,
  zaroltTemakor = false,
  evfolyamKotelezo = false,
  agazatRejtett = false,
  agazatAlatti,
}: {
  evfolyamId: string;
  agazatId: string;
  tantargyId: string;
  temakorId: string;
  evfolyamok: Opt[];
  agazatok: Opt[];
  tantargyak: Opt[];
  temakorok: Opt[];
  onEvfolyam: (id: string) => void;
  onAgazat: (id: string) => void;
  onTantargy: (id: string) => void;
  onTemakor: (id: string) => void;
  onTemakorReload?: () => Promise<void>;
  onTemakorModalOpen?: () => void;
  temakorUresFelirat?: string;
  kotelezo?: boolean;
  ujTemakor?: boolean;
  zaroltAgazat?: boolean;
  zaroltTantargy?: boolean;
  zaroltTemakor?: boolean;
  evfolyamKotelezo?: boolean;
  agazatRejtett?: boolean;
  agazatAlatti?: ReactNode;
}) {
  const [temakorOpen, setTemakorOpen] = useState(false);
  const [temakorTorlesOpen, setTemakorTorlesOpen] = useState(false);

  const evfolyamPlaceholder = evfolyamKotelezo ? "Válassz" : "Mind";
  const agazatPlaceholder = kotelezo ? "Válassz ágazatot" : "Minden ágazat";
  const tantargyPlaceholder = !agazatId
    ? "Előbb válassz ágazatot"
    : kotelezo
      ? "Válassz tantárgyat"
      : "Minden tantárgy";
  const temakorPlaceholder = !tantargyId ? "Előbb válassz tantárgyat" : temakorUresFelirat;

  return (
    <>
      <div
        className={`mb-4 grid min-w-0 gap-3 sm:grid-cols-2 ${
          agazatRejtett
            ? "lg:grid-cols-[minmax(4.5rem,0.55fr)_repeat(2,minmax(0,1fr))]"
            : "lg:grid-cols-[minmax(4.5rem,0.55fr)_repeat(3,minmax(0,1fr))]"
        }`}
      >
        <Field label="Évfolyam">
          <WrapSelect
            value={evfolyamId}
            onChange={onEvfolyam}
            required={evfolyamKotelezo}
            placeholder={evfolyamPlaceholder}
            options={evfolyamok.map((e) => ({ value: e.id, label: e.nev }))}
          />
        </Field>
        {!agazatRejtett ? (
          <Field label="Ágazat">
            <WrapSelect
              value={agazatId}
              onChange={onAgazat}
              required={kotelezo}
              disabled={zaroltAgazat}
              placeholder={agazatPlaceholder}
              options={agazatok.map((a) => ({ value: a.id, label: a.nev }))}
            />
            {agazatAlatti}
          </Field>
        ) : null}
        <Field label="Tantárgy">
          <WrapSelect
            value={tantargyId}
            onChange={onTantargy}
            required={kotelezo}
            disabled={!agazatId || zaroltTantargy}
            placeholder={tantargyPlaceholder}
            options={tantargyak.map((t) => ({ value: t.id, label: t.nev }))}
          />
        </Field>
        <Field label="Témakör">
          <WrapSelect
            value={temakorId}
            onChange={onTemakor}
            disabled={!tantargyId || zaroltTemakor}
            required={kotelezo && temakorUresFelirat !== "Témazáró"}
            placeholder={temakorPlaceholder}
            options={temakorok.map((t) => ({ value: t.id, label: t.nev }))}
          />
          {ujTemakor ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!tantargyId}
                className="w-full sm:w-auto"
                onClick={() => {
                  onTemakorModalOpen?.();
                  setTemakorOpen(true);
                }}
              >
                Új témakör
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={!tantargyId}
                className="w-full sm:w-auto"
                onClick={() => setTemakorTorlesOpen(true)}
              >
                Témakör törlése
              </Button>
            </div>
          ) : null}
        </Field>
      </div>

      {ujTemakor && temakorTorlesOpen ? (
        <TemakorTorlesModal
          tantargyId={tantargyId}
          kivalasztottTemakorId={temakorId}
          onClose={() => setTemakorTorlesOpen(false)}
          onDeleted={async (toroltId) => {
            setTemakorTorlesOpen(false);
            await onTemakorReload?.();
            if (temakorId === toroltId) onTemakor("");
          }}
        />
      ) : null}

      {ujTemakor && temakorOpen ? (
        <UjTemakorModal
          tantargyId={tantargyId}
          onClose={() => setTemakorOpen(false)}
          onSaved={async (newTemakorId) => {
            setTemakorOpen(false);
            await onTemakorReload?.();
            onTemakor(newTemakorId);
          }}
        />
      ) : null}
    </>
  );
}
