import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const SIDEBAR_COLLAPSED = 64;
const SIDEBAR_EXPANDED = 220;

const NAV_ITEMS: Array<{ to: string; label: string; icon: string }> = [
  { to: "/board", label: "To-Do List", icon: "☰" },
  { to: "/diary", label: "Diary", icon: "✎" },
  { to: "/vault", label: "Vault", icon: "🔒" },
  { to: "/expenses", label: "Expenses", icon: "₹" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

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

      {/* Mobile: horizontal nav visible on small screens */}
      <nav className="md:hidden flex gap-1.5 px-5 pt-3 pb-2 border-b border-line max-w-[1500px] w-full mx-auto flex-wrap">
        {NAV_ITEMS.map((it) => (
          <MobileNavTab key={it.to} to={it.to} label={it.label} icon={it.icon} />
        ))}
      </nav>

      {/* Desktop layout: sidebar + main */}
      <div className="flex flex-1 relative">
        <aside
          className="relative flex-shrink-0 max-md:hidden"
          style={{ width: `${SIDEBAR_COLLAPSED}px` }}
        >
          <div
            className="fixed top-[88px] bottom-0 left-0 bg-bg-2 border-r border-line ease-out overflow-hidden z-30 shadow-brand"
            style={{
              width: `${expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED}px`,
              transition: "width 200ms ease-out",
              willChange: "width",
            }}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
          >
            <nav className="flex flex-col gap-1 p-2 pt-4">
              {NAV_ITEMS.map((it) => (
                <SideNavItem
                  key={it.to}
                  to={it.to}
                  label={it.label}
                  icon={it.icon}
                  expanded={expanded}
                />
              ))}
            </nav>
            <div
              className="absolute bottom-3 left-0 right-0 px-3 text-[10px] text-muted whitespace-nowrap transition-opacity duration-200"
              style={{ opacity: expanded ? 0.6 : 0 }}
            >
              Hover expands this nav
            </div>
          </div>
        </aside>

        <main className="flex-1 max-w-[1500px] w-full mx-auto px-9 pb-10 pt-6 max-md:px-5 max-md:max-w-none">
          {children}
        </main>
      </div>

      <footer className="text-center py-4 text-muted text-xs border-t border-line">
        Forgmind Workspace &middot; Synced to your account
      </footer>
    </div>
  );
}

function SideNavItem({
  to,
  label,
  icon,
  expanded,
}: {
  to: string;
  label: string;
  icon: string;
  expanded: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 h-11 px-2 rounded-lg transition-colors no-underline ${
          isActive
            ? "text-white bg-bg-3 border border-line"
            : "text-muted hover:text-white hover:bg-brand-soft border border-transparent"
        }`
      }
      title={label}
    >
      <span className="text-xl w-8 flex-shrink-0 text-brand-red text-center leading-none">
        {icon}
      </span>
      <span
        className="text-sm font-semibold whitespace-nowrap transition-opacity duration-150"
        style={{
          opacity: expanded ? 1 : 0,
          pointerEvents: expanded ? "auto" : "none",
        }}
      >
        {label}
      </span>
    </NavLink>
  );
}

function MobileNavTab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `no-underline font-semibold text-xs px-3 py-2 rounded-lg border transition-all inline-flex items-center gap-1.5 ${
          isActive
            ? "text-white bg-bg-2 border-brand-red"
            : "text-muted border-line hover:text-white hover:bg-brand-soft"
        }`
      }
    >
      <span className="text-brand-red">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}
