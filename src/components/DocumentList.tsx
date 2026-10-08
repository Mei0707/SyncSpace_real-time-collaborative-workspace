import { NavLink } from "react-router-dom";
import { FileText } from "lucide-react";
import type { WorkspaceDocument } from "../data/types";
import { relativeTime } from "../lib/date";
import { cn } from "../lib/cn";

export function DocumentList({
  documents,
}: {
  documents: WorkspaceDocument[];
}) {
  if (documents.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-soft">
        No documents match this search.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {documents.map((document) => (
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
    </div>
  );
}
