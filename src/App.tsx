import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, FolderKanban, CalendarRange, Users, LogOut } from "lucide-react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Avatar, Spinner } from "./components/ui";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { ProjectDetail } from "./pages/ProjectDetail";
import { Scheduler } from "./pages/Scheduler";
import { Clients } from "./pages/Clients";
import { ArtistHome } from "./pages/ArtistHome";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/scheduler", label: "Scheduler", icon: CalendarRange },
  { to: "/clients", label: "Clients", icon: Users },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="rounded-lg flex items-center justify-center font-display" style={{ width: 28, height: 28, background: "#e8795a", color: "#1a0d08", fontSize: 15 }}>S</div>
      <span className="font-display text-lg" style={{ color: "#f1f5f9" }}>Studio<span style={{ color: "#e8795a" }}>Time</span></span>
    </div>
  );
}

function UserChip() {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Avatar id={profile!.id} name={profile!.full_name ?? "User"} size={28} />
        <div className="hidden sm:block leading-tight">
          <div className="font-body text-sm" style={{ color: "#e2e8f0" }}>{profile!.full_name ?? "User"}</div>
          <div className="font-body text-xs capitalize" style={{ color: "#64748b" }}>{profile!.role}</div>
        </div>
      </div>
      <button onClick={() => signOut()} title="Sign out" className="rounded-lg p-2" style={{ color: "#7b8a9a", background: "#161f29", border: "1px solid #25323f" }}>
        <LogOut size={16} />
      </button>
    </div>
  );
}

function pageTitle(path: string) {
  if (path.startsWith("/projects/")) return "Project";
  const item = NAV.find((n) => path.startsWith(n.to));
  return item?.label ?? "Dashboard";
}

function ManagerShell() {
  const loc = useLocation();
  return (
    <div className="min-h-screen" style={{ background: "#080c11" }}>
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col px-3 py-5 border-r" style={{ background: "#0b0f14", borderColor: "#161f29" }}>
        <div className="px-2 mb-6"><Brand /></div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-body"
              style={({ isActive }) => ({ background: isActive ? "rgba(232,121,90,0.14)" : "transparent", color: isActive ? "#f1c2b1" : "#9fb0c0" })}>
              <n.icon size={17} /> {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main column */}
      <div className="md:pl-56">
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b" style={{ background: "rgba(8,12,17,0.85)", backdropFilter: "blur(8px)", borderColor: "#161f29" }}>
          <div className="flex items-center gap-3">
            <div className="md:hidden"><Brand /></div>
            <h1 className="hidden md:block font-display text-xl" style={{ color: "#f1f5f9" }}>{pageTitle(loc.pathname)}</h1>
          </div>
          <UserChip />
        </header>
        <main className="px-4 sm:px-6 py-5 pb-24 md:pb-8 mx-auto" style={{ maxWidth: 1280 }}>
          <Outlet />
        </main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t" style={{ background: "#0b0f14", borderColor: "#161f29" }}>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className="flex-1 flex flex-col items-center gap-0.5 py-2.5 font-body text-xs"
            style={({ isActive }) => ({ color: isActive ? "#e8795a" : "#7b8a9a" })}>
            <n.icon size={18} /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ArtistShell() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"home" | "scheduler">("home");
  const tabBtn = (key: "home" | "scheduler", label: string) => (
    <button onClick={() => setTab(key)} className="rounded-lg px-3 py-1.5 text-sm font-body"
      style={{ background: tab === key ? "rgba(232,121,90,0.14)" : "transparent", color: tab === key ? "#f1c2b1" : "#9fb0c0" }}>
      {label}
    </button>
  );
  return (
    <div className="min-h-screen" style={{ background: "#080c11" }}>
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3 border-b" style={{ background: "rgba(8,12,17,0.85)", backdropFilter: "blur(8px)", borderColor: "#161f29" }}>
        <div className="flex items-center gap-4">
          <Brand />
          <nav className="flex items-center gap-1">
            {tabBtn("home", "My Projects")}
            {tabBtn("scheduler", "Scheduler")}
          </nav>
        </div>
        <UserChip />
      </header>
      <main className="px-4 sm:px-6 py-5 pb-24 mx-auto" style={{ maxWidth: tab === "scheduler" ? 1280 : 1100 }}>
        {tab === "home" ? <ArtistHome /> : <Scheduler role="artist" currentUserId={profile!.id} />}
      </main>
    </div>
  );
}

function Gate() {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c11" }}><Spinner /></div>;
  if (!session) return <Login />;
  // session exists but profile row not loaded yet
  if (!profile) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#080c11" }}><Spinner label="Loading your profile…" /></div>;

  if (profile.role === "artist") return <ArtistShell />;

  return (
    <Routes>
      <Route element={<ManagerShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/scheduler" element={<Scheduler />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
