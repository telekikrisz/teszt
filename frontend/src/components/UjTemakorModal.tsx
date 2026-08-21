import { useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { Button, ErrorText, Field, Input, Modal } from "./ui";

export function UjTemakorModal({
  tantargyId,
  onClose,
  onSaved,
}: {
  tantargyId: string;
  onClose: () => void;
  onSaved: (temakorId: string) => Promise<void>;
}) {
  const { pathname } = useLocation();
  const modalTheme = pathname.startsWith("/admin") ? "admin" : "tanar";
  const [nev, setNev] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  async function mentes() {
    if (!nev.trim() || !tantargyId || pending) return;
    setPending(true);
    setError(null);
    try {
      const data = await api.post<{ temakor: { temakorId: string } }>("/api/temakorok", {
        tantargyId,
        nev: nev.trim(),
      });
      await onSaved(data.temakor.temakorId);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Új témakör" theme={modalTheme} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Megnevezés">
          <Input
            value={nev}
            onChange={(e) => setNev(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void mentes();
              }
            }}
          />
        </Field>
        <ErrorText error={error} />
        <div className="flex gap-2">
          <Button type="button" disabled={pending || !tantargyId || !nev.trim()} onClick={() => void mentes()}>
            {pending ? "Mentés..." : "Mentés"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            Mégse
          </Button>
        </div>
      </div>
    </Modal>
  );
}
