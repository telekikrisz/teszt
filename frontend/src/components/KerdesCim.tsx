import { joValaszFelirat } from "@oktateszt/shared";

type KerdesCimProps = {
  szoveg: string;
  joValaszDb: number;
  className?: string;
};

export function KerdesCim({ szoveg, joValaszDb, className }: KerdesCimProps) {
  const felirat = joValaszFelirat(joValaszDb);
  return (
    <p className={className}>
      {szoveg}
      {felirat ? <span className="font-normal text-ink/60"> {felirat}</span> : null}
    </p>
  );
}
