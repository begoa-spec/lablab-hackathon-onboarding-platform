import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Auth from "./components/Auth";
import AppLayout from "./components/AppLayout";
import DashboardPlaceholder from "./pages/DashboardPlaceholder";
import WizardPlaceholder from "./pages/WizardPlaceholder";
import HackathonsPlaceholder from "./pages/HackathonsPlaceholder";
import { Loader2 } from "lucide-react";
import { supabase } from "./lib/supabase";

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole?: "participant" | "organizer";
}) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return <Navigate to="/" replace />;
  }

  // Unknown role: send back to auth
  if (auth.role === "unknown") {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && auth.role !== allowedRole) {
    if (auth.role === "organizer") return <Navigate to="/dashboard" replace />;
    if (auth.role === "participant") return <Navigate to="/wizard" replace />;
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function NoAccess({ userEmail }: { userEmail?: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
          <span className="text-accent font-heading text-2xl">LL</span>
        </div>
        <h1 className="font-heading text-2xl text-foreground mb-2">Signed In</h1>
        <p className="text-foreground/60 mb-2">
          Your account <strong className="text-foreground">{userEmail}</strong> has been verified,
          but you haven't been invited to a hackathon yet.
        </p>
        <p className="text-foreground/50 text-sm mb-6">
          Contact your organizer to get access. If you believe this is a mistake, try signing out
          and signing in again.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-6 py-3 bg-accent text-black font-semibold rounded-xl hover:opacity-90 transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const auth = useAuth();

  return (
    <Routes>
      {/* Public route — sign-in */}
      <Route
        path="/"
        element={
          auth.status === "authenticated" ? (
            auth.role === "organizer" ? (
              <Navigate to="/dashboard" replace />
            ) : auth.role === "participant" ? (
              <Navigate to="/wizard" replace />
            ) : (
              <NoAccess userEmail={auth.user?.email} />
            )
          ) : auth.status === "unauthenticated" ? (
            <Auth />
          ) : (
            <div className="min-h-screen bg-background flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden="true" />
            </div>
          )
        }
      />

      {/* Authenticated routes wrapped in AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Organizer routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRole="organizer">
              <DashboardPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hackathons"
          element={
            <ProtectedRoute allowedRole="organizer">
              <HackathonsPlaceholder />
            </ProtectedRoute>
          }
        />

        {/* Participant routes */}
        <Route
          path="/wizard"
          element={
            <ProtectedRoute allowedRole="participant">
              <WizardPlaceholder />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}