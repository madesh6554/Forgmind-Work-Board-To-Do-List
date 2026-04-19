import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import Login from "@/routes/Login";
import Board from "@/routes/Board";
import Diary from "@/routes/Diary";
import Vault from "@/routes/Vault";
import Expenses from "@/routes/Expenses";

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted text-sm">
        Loading...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/board"
        element={
          <ProtectedLayout>
            <Board />
          </ProtectedLayout>
        }
      />
      <Route
        path="/diary"
        element={
          <ProtectedLayout>
            <Diary />
          </ProtectedLayout>
        }
      />
      <Route
        path="/vault"
        element={
          <ProtectedLayout>
            <Vault />
          </ProtectedLayout>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedLayout>
            <Expenses />
          </ProtectedLayout>
        }
      />
      <Route path="/" element={<Navigate to="/board" replace />} />
      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  );
}
