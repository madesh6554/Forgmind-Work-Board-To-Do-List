import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center justify-between px-9 py-[22px] border-b border-line backdrop-blur-sm max-md:px-5 max-md:flex-wrap max-md:gap-2.5">
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center font-extrabold text-[22px] text-white tracking-wide shadow-brand-glow"
            style={{ background: "linear-gradient(135deg, #e10b1f, #8b0714)" }}
          >
            F
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-wide">Forgmind Workspace</h1>
            <p className="text-xs text-muted mt-0.5">Your personal space</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {user && (
            <span className="text-[13px] text-muted px-3 py-2 border border-line rounded-full bg-bg-2 max-md:text-xs max-md:px-2.5 max-md:py-1.5">
              {user.email}
            </span>
          )}
          <button className="btn btn-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="flex gap-1.5 px-9 pt-3 border-b border-line max-w-[1500px] w-full mx-auto max-md:px-5">
        <NavTab to="/board" label="To-Do List" icon="☰" />
        <NavTab to="/diary" label="Diary" icon="✎" />
      </nav>

      <main className="flex-1 max-w-[1500px] w-full mx-auto px-9 pb-10 pt-6 max-md:px-5">
        {children}
      </main>

      <footer className="text-center py-4 text-muted text-xs border-t border-line">
        Forgmind Workspace &middot; Synced to your account
      </footer>
    </div>
  );
}

function NavTab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative top-[1px] no-underline font-semibold text-sm px-4.5 py-3 rounded-t-[10px] border border-transparent border-b-0 inline-flex items-center gap-2 transition-all ${
          isActive
            ? "text-white bg-bg-2 border-line"
            : "text-muted hover:text-white hover:bg-brand-soft"
        }`
      }
      style={({ isActive }) =>
        isActive
          ? {
              borderBottomColor: "#1a1a22",
            }
          : {}
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute left-[10%] right-[10%] top-0 h-0.5"
              style={{
                background: "linear-gradient(90deg, transparent, #e10b1f, transparent)",
              }}
            />
          )}
          <span className="text-[15px] text-brand-red">{icon}</span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}
