import { ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CircleHelp,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { DocumentList } from "./DocumentList";
import { StatusPill } from "./StatusPill";
import { useAuth } from "../hooks/authContext";
import { useCreateDocument, useWorkspaceSearch } from "../hooks/useWorkspace";
import { cn } from "../lib/cn";
import { useUiStore } from "../stores/useUiStore";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [search, setSearch] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { data, documents, isLoading } = useWorkspaceSearch(search);
  const createDocument = useCreateDocument();
  const canCreateDocument =
    data?.currentUserRole === "owner" ||
    data?.currentUserRole === "admin" ||
    data?.currentUserRole === "editor";

  async function handleCreateDocument() {
    if (!canCreateDocument) {
      return;
    }

    const document = await createDocument.mutateAsync("Untitled document");
    navigate(`/documents/${document.id}`);
    onNavigate?.();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-1 pb-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="inline-flex items-center gap-3 rounded-md"
        >
          <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-sm font-black text-panel">
            S
          </span>
          <span>
            <span className="block text-sm font-semibold leading-5">SyncSpace</span>
            <span className="block text-[11px] leading-4 text-soft">
              {data?.name ?? "Workspace"}
            </span>
          </span>
        </Link>
      </div>

      <div className="space-y-1 border-y border-line/80 py-4">
        <p className="px-2 pb-2 text-[11px] font-semibold uppercase text-soft">
          General
        </p>
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition",
            location.pathname === "/"
              ? "bg-muted text-ink"
              : "text-soft hover:bg-muted hover:text-ink",
          )}
        >
          <LayoutDashboard size={15} />
          Dashboard
        </Link>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-soft transition hover:bg-muted hover:text-ink"
        >
          <Files size={15} />
          Files
        </button>
        <Link
          to="/team"
          onClick={onNavigate}
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm transition hover:bg-muted hover:text-ink",
            location.pathname === "/team"
              ? "bg-muted font-medium text-ink"
              : "text-soft",
          )}
        >
          <Users size={15} />
          Team
        </Link>
      </div>

      <div className="space-y-3 border-b border-line/80 py-4">
        <label className="relative block">
          <span className="sr-only">Search documents</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-soft"
            size={15}
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 w-full rounded-md border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-soft/80"
            placeholder="Search"
          />
        </label>

        <button
          type="button"
          onClick={handleCreateDocument}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-panel transition hover:bg-ink/90 disabled:opacity-60"
          disabled={!canCreateDocument || createDocument.isPending}
        >
          <Plus size={15} />
          New document
        </button>
      </div>

      <div className="mt-4 mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase text-soft">
          Documents
        </p>
        <span className="text-[11px] text-soft">{documents.length}</span>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Documents">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : (
          <DocumentList documents={documents} />
        )}
      </nav>

      <div className="mt-4 space-y-1 border-t border-line pt-4">
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-soft transition hover:bg-muted hover:text-ink"
        >
          <CircleHelp size={15} />
          Help
        </button>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm text-soft transition hover:bg-muted hover:text-ink"
        >
          <Settings size={15} />
          Settings
        </button>
      </div>
    </div>
  );
}

function BrowserChrome() {
  return (
    <div className="hidden h-10 shrink-0 items-center gap-4 border-b border-line bg-muted/45 px-4 md:flex">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="mx-auto flex h-6 w-[min(28rem,45vw)] items-center justify-center rounded-md bg-panel/80 px-3 text-[11px] text-soft ring-1 ring-line">
        SyncSpace / workspace
      </div>
      <div className="w-16" />
    </div>
  );
}

function TopBar({ mobileSidebar }: { mobileSidebar: ReactNode }) {
  const {
    connectionStatus,
    isSidebarOpen,
    theme,
    toggleSidebar,
    toggleTheme,
  } = useUiStore();
  const { logout, user } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel/92 px-4 backdrop-blur md:px-5">
      <div className="flex items-center gap-3">
        <div className="md:hidden">{mobileSidebar}</div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink md:grid"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarOpen ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        <StatusPill status={connectionStatus} />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="hidden h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink sm:grid"
          aria-label="Notifications"
        >
          <Bell size={16} />
        </button>
        <button
          type="button"
          className="hidden h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink sm:grid"
          aria-label="Messages"
        >
          <MessageCircle size={16} />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="grid h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        {user ? (
          <div className="ml-1 hidden items-center gap-2 rounded-md border border-line bg-canvas/70 py-1 pl-1 pr-1 md:flex">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
            <span className="hidden min-w-0 lg:block">
              <span className="block max-w-28 truncate text-xs font-semibold leading-4">
                {user.name}
              </span>
              <span className="block text-[10px] leading-3 text-soft">
                Workspace member
              </span>
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              className="grid h-7 w-7 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function WorkspaceLayout() {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const theme = useUiStore((state) => state.theme);
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const mobileSidebar = (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="grid h-10 w-10 place-items-center rounded-md border border-line text-soft transition hover:bg-muted hover:text-ink"
      aria-label="Open navigation"
    >
      <Menu size={18} />
    </button>
  );

  return (
    <div className="min-h-screen bg-canvas p-0 text-ink md:p-5">
      <div className="flex min-h-screen flex-col overflow-hidden bg-panel shadow-2xl md:min-h-[calc(100vh-2.5rem)] md:rounded-[18px] md:border md:border-line">
        <BrowserChrome />
        <div className="flex min-h-0 flex-1">
          <aside
            className={cn(
              "hidden border-r border-line bg-muted/45 px-4 py-5 transition-[width] duration-200 md:block",
              isSidebarOpen ? "w-[19rem]" : "w-0 overflow-hidden p-0",
            )}
          >
            <SidebarContent />
          </aside>

          {isMobileOpen ? (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              />
              <aside className="relative h-full w-[min(22rem,88vw)] bg-panel px-4 py-5 shadow-xl">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </aside>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar mobileSidebar={mobileSidebar} />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
