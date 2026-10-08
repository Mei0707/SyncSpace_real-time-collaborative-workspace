import { NavLink } from "react-router-dom";
import { FileText } from "lucide-react";
import type { WorkspaceDocument } from "../data/types";
import { relativeTime } from "../lib/date";
import { cn } from "../lib/cn";
import { useVirtualList } from "../hooks/useVirtualList";

export function DocumentList({
  documents,
}: {
  documents: WorkspaceDocument[];
}) {
  const virtualList = useVirtualList({
    itemCount: documents.length,
    itemHeight: 86,
    overscan: 6,
    defaultViewportHeight: 620,
  });
  const visibleDocuments = documents.slice(
    virtualList.startIndex,
    virtualList.endIndex,
  );

  if (documents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-soft">
        No documents match this search.
      </div>
    );
  }

  return (
    <div
      ref={virtualList.containerRef}
      onScroll={virtualList.handleScroll}
      className={cn(
        "space-y-1",
        virtualList.isVirtualized ? "h-full overflow-y-auto pr-1" : "",
      )}
    >
      {virtualList.paddingBefore ? (
        <div style={{ height: virtualList.paddingBefore }} />
      ) : null}
      {visibleDocuments.map((document) => (
        <NavLink
          key={document.id}
          to={`/documents/${document.id}`}
          className={({ isActive }) =>
            cn(
              "group block rounded-md border px-3 py-2.5 transition",
              isActive
                ? "border-line bg-muted text-ink shadow-sm"
                : "border-transparent hover:bg-muted/70",
            )
          }
        >
          <span className="flex items-start gap-2.5">
            <span className="mt-0.5 text-soft transition group-hover:text-brand">
              <FileText size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {document.title}
              </span>
              <span className="mt-0.5 block truncate text-xs leading-5 text-soft">
                {document.summary}
              </span>
              <span className="mt-1.5 flex items-center gap-2 text-[11px] text-soft">
                <span>{document.status}</span>
                <span className="h-1 w-1 rounded-full bg-line" aria-hidden="true" />
                <span>{relativeTime(document.updatedAt)}</span>
              </span>
            </span>
          </span>
        </NavLink>
      ))}
      {virtualList.paddingAfter ? (
        <div style={{ height: virtualList.paddingAfter }} />
      ) : null}
    </div>
  );
}
