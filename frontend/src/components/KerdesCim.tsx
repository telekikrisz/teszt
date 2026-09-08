import { joValaszFelirat } from "@oktateszt/shared";
import { KerdesKep } from "./KerdesKep";

type KerdesCimProps = {
  szoveg: string;
  joValaszDb: number;
  kepFajl?: string | null;
  className?: string;
};

export function KerdesCim({ szoveg, joValaszDb, kepFajl, className }: KerdesCimProps) {
  const felirat = joValaszFelirat(joValaszDb);
  return (
    <div>
      <p className={className}>
        {szoveg}
        {felirat ? <span className="font-normal text-ink/60"> {felirat}</span> : null}
      </p>
      <KerdesKep fajl={kepFajl} />
    </div>
  );
}
