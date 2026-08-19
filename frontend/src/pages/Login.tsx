import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { Button, ErrorText, Field, Input } from "../components/ui";
import { api, homeFor, type PublicUser } from "../lib/api";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);

  if (!loading && user) return <Navigate to={homeFor(user)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await api.post<{ user: PublicUser }>("/api/auth/login", { email, password });
      await refresh();
      navigate(homeFor(data.user));
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Belépés sikertelen."));
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center px-4"
      style={{
        backgroundImage: "url('/hatter.avif')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* sötétítő réteg */}
      <div className="absolute inset-0 bg-[#0d1f1a]/55" />
      {/* fallback gradient kép nélkül */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_40%_30%,_#1a3a2a,_#0d1f1a)]" />

      {/* belépő kártya – középen */}
      <div className="relative z-10 w-full max-w-sm text-center">
        <BrandMark variant="login" />

        <div className="mt-8 rounded-2xl bg-white/96 p-8 shadow-2xl backdrop-blur-sm text-left">
          <h2 className="font-display text-2xl text-center mb-6" style={{ color: "#1a3a2a" }}>Belépés</h2>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="E-mail cím">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                className="focus:border-[#2d6a4a]"
              />
            </Field>
            <Field label="Jelszó">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="focus:border-[#2d6a4a]"
              />
            </Field>
            <ErrorText error={error} />
            <button
              type="submit"
              disabled={pending}
              className="mt-2 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition"
              style={{ backgroundColor: pending ? "#2d6a4a" : "#2d6a4a" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1f4e35"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#2d6a4a"; }}
            >
              {pending ? "Belépés..." : "Belépés"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
