import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "login" | "register";

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/board", { replace: true });
  }, [user, loading, navigate]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) navigate("/board", { replace: true });
    else setError(res.error || "Invalid email or password.");
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await register(email, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Could not create account.");
      return;
    }
    if (res.needsConfirm) {
      setInfo("Check your email to confirm, then log in.");
      setTab("login");
    } else {
      navigate("/board", { replace: true });
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setError("");
    setInfo("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        <div className="card-accent p-7">
          <div className="flex items-center gap-3.5 mb-5">
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center font-extrabold text-[22px] text-white shadow-brand-glow"
              style={{ background: "linear-gradient(135deg, #e10b1f, #8b0714)" }}
            >
              F
            </div>
            <div>
              <h1 className="text-lg font-semibold">Forgmind Workspace</h1>
              <p className="text-xs text-muted mt-0.5">Sign in to continue</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-bg-1 border border-line p-1 rounded-[10px] mb-4">
            <TabButton active={tab === "login"} onClick={() => switchTab("login")}>
              Login
            </TabButton>
            <TabButton active={tab === "register"} onClick={() => switchTab("register")}>
              Create Account
            </TabButton>
          </div>

          {tab === "login" ? (
            <form className="flex flex-col gap-3.5" onSubmit={onLogin} autoComplete="off">
              <Field label="Email">
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={120}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  maxLength={64}
                />
              </Field>
              <Feedback error={error} info={info} />
              <button className="btn btn-primary py-3 mt-1" type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            <form className="flex flex-col gap-3.5" onSubmit={onRegister} autoComplete="off">
              <Field label="Email">
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={120}
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={64}
                />
              </Field>
              <Field label="Confirm Password">
                <input
                  type="password"
                  className="input"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={6}
                  maxLength={64}
                />
              </Field>
              <Feedback error={error} info={info} />
              <button className="btn btn-primary py-3 mt-1" type="submit" disabled={busy}>
                {busy ? "Creating..." : "Create Account"}
              </button>
            </form>
          )}

          <p className="text-center text-muted text-[11px] mt-4">
            Your account works on any device.
          </p>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-0 py-2.5 px-2.5 rounded-lg cursor-pointer text-[13px] font-semibold transition ${
        active
          ? "text-white shadow-brand-glow"
          : "bg-transparent text-muted hover:bg-bg-2"
      }`}
      style={
        active
          ? { background: "linear-gradient(135deg, #e10b1f, #8b0714)" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Feedback({ error, info }: { error: string; info: string }) {
  if (!error && !info) return <div className="min-h-4" />;
  return (
    <div
      className={`text-xs min-h-4 ${error ? "text-[#ff8a95]" : "text-[#6be675]"}`}
    >
      {error || info}
    </div>
  );
}
