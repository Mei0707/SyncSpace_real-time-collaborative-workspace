import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { useAuth } from "./hooks/authContext";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

const DocumentPage = lazy(() =>
  import("./pages/DocumentPage").then((module) => ({
    default: module.DocumentPage,
  })),
);

function RouteLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="h-[70vh] animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function App() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-6 text-ink">
        <div className="h-16 w-full max-w-sm animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <Routes>
      <Route element={<WorkspaceLayout />}>
        <Route index element={<DashboardPage />} />
        <Route
          path="documents/:documentId"
          element={
            <Suspense fallback={<RouteLoading />}>
              <DocumentPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
