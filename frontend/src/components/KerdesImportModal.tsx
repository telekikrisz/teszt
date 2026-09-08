import { useRef, useState } from "react";
import { Button, ErrorText, Modal } from "./ui";
import { api } from "../lib/api";
import { downloadKerdesImportSablon, parseKerdesImportFile } from "../lib/kerdesImport";

type ImportEredmeny = {
  letrehozott: number;
  ujTemakorok: string[];
};

export function KerdesImportModal({
  theme = "tanar",
  onClose,
  onDone,
}: {
  theme?: "tanar" | "admin";
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [eredmeny, setEredmeny] = useState<ImportEredmeny | null>(null);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const kerdesek = await parseKerdesImportFile(file);
      const result = await api.post<ImportEredmeny>("/api/kerdesek/import", { kerdesek });
      setEredmeny(result);
      await onDone();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Modal title="Kérdések importálása" theme={theme} onClose={() => !pending && onClose()}>
      {eredmeny ? (
        <div className="space-y-4">
          <p className="rounded-lg border border-moss/30 bg-moss/10 px-3 py-2 text-sm text-navy">
            {eredmeny.letrehozott} kérdés importálva
            {eredmeny.ujTemakorok.length > 0
              ? `, ${eredmeny.ujTemakorok.length} új témakör: ${eredmeny.ujTemakorok.join(", ")}.`
              : "."}
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Kész
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink/80">
            Egy fájlban keverhetők a különböző évfolyamok, ágazatok és tantárgyak. Az ágazatnak és a
            tantárgynak már léteznie kell a rendszerben; a hiányzó témakört a program felveszi. Ha egy
            sor hibás, semmi sem kerül be.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/70">
            <li>Töltsd le a sablont, és Excelben töltsd ki (évfolyam, ágazat, tantárgy, témakör, kérdés, válaszok).</li>
            <li>
              Kérdésenként más-más számú válasz lehet: a felesleges cellákat hagyd üresen, vagy szúrj be{" "}
              <em>Válasz N / Jó N</em> oszlopokat (max. 12).
            </li>
            <li>
              A <em>Jó</em> oszlopba írj <strong>IGEN</strong> vagy <strong>NEM</strong>.
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => downloadKerdesImportSablon()}>
              Sablon letöltése (.xlsx)
            </Button>
            <Button type="button" disabled={pending} onClick={() => inputRef.current?.click()}>
              {pending ? "Import..." : "Fájl feltöltése"}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.csv,.tsv,.txt"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <ErrorText error={error} />
        </div>
      )}
    </Modal>
  );
}
