import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
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
