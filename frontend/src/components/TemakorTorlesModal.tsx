import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { Button, Empty, ErrorText, Modal } from "./ui";

type TemakorSor = {
  temakorId: string;
  temakorNev: string;
};

export function TemakorTorlesModal({
  tantargyId,
  kivalasztottTemakorId,
  onClose,
  onDeleted,
}: {
  tantargyId: string;
  kivalasztottTemakorId: string;
  onClose: () => void;
  onDeleted: (toroltId: string) => Promise<void>;
}) {
  const { pathname } = useLocation();
  const modalTheme = pathname.startsWith("/admin") ? "admin" : "tanar";
  const [lista, setLista] = useState<TemakorSor[]>([]);
  const [kijeloltId, setKijeloltId] = useState(kivalasztottTemakorId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let el = true;
    async function betolt() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ temakorok: TemakorSor[] }>(`/api/temakorok?tantargyId=${tantargyId}`);
        if (!el) return;
        const sorok = data.temakorok;
        setLista(sorok);
        setKijeloltId((prev) => {
          if (prev && sorok.some((t) => t.temakorId === prev)) return prev;
          if (kivalasztottTemakorId && sorok.some((t) => t.temakorId === kivalasztottTemakorId)) {
            return kivalasztottTemakorId;
          }
          return sorok[0]?.temakorId ?? "";
        });
      } catch (err) {
        if (el) setError(err);
      } finally {
        if (el) setLoading(false);
      }
    }
    void betolt();
    return () => {
      el = false;
    };
  }, [tantargyId, kivalasztottTemakorId]);

  const kijelolt = lista.find((t) => t.temakorId === kijeloltId);

  async function torles() {
    if (!kijeloltId || !kijelolt || pending) return;
    if (!confirm(`Archiválod a „${kijelolt.temakorNev}” témakört?`)) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.delete(`/api/temakorok/${kijeloltId}`);
      await onDeleted(kijeloltId);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title="Témakör törlése" theme={modalTheme} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink/70">
          Válaszd ki a törölni kívánt témakört a tantárgy aktív témakörei közül.
        </p>

        {loading ? <p className="text-sm text-ink/60">Betöltés...</p> : null}
        {!loading && lista.length === 0 ? <Empty>Nincs törölhető témakör ebben a tantárgyban.</Empty> : null}

        {!loading && lista.length > 0 ? (
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-rule p-1">
            {lista.map((t) => {
              const aktiv = t.temakorId === kijeloltId;
              return (
                <li key={t.temakorId}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      aktiv
                        ? "bg-[#dce8e0] font-semibold text-[#1a3d2f] ring-1 ring-[#7bc995]/40"
                        : "text-navy hover:bg-paper"
                    }`}
                    onClick={() => setKijeloltId(t.temakorId)}
                  >
                    {t.temakorNev}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <ErrorText error={error} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="danger"
            disabled={pending || loading || !kijeloltId || lista.length === 0}
            onClick={() => void torles()}
          >
            {pending ? "Törlés..." : "Törlés"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
            Mégse
          </Button>
        </div>
      </div>
    </Modal>
  );
}
