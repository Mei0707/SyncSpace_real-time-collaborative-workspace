import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { EditorContent } from "@tiptap/react";
import { Check, Clock, Save, Trash2 } from "lucide-react";
import { AvatarStack } from "../components/AvatarStack";
import { EditorToolbar } from "../components/EditorToolbar";
import type { WorkspaceDocument } from "../data/types";
import { useCollaborativeDocument } from "../hooks/useCollaborativeDocument";
import {
  useDeleteDocument,
  useDocument,
  useUpdateDocument,
} from "../hooks/useWorkspace";
import { relativeTime } from "../lib/date";

function DocumentEditor({ document }: { document: WorkspaceDocument }) {
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const { editor, isSynced, localUser, presence } = useCollaborativeDocument(
    document.id,
    document.content,
  );

  useEffect(() => {
    setTitle(document.title);
  }, [document]);

  const hasTitleChanges = useMemo(() => {
    return document.title !== title;
  }, [document.title, title]);

  async function handleSave() {
    if (!hasTitleChanges) {
      return;
    }

    await updateDocument.mutateAsync({
      id: document.id,
      title,
      content: editor?.getText() ?? document.content,
      summary: (editor?.getText() ?? document.content).slice(0, 120),
    });
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${document.title}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    await deleteDocument.mutateAsync(document.id);
    navigate("/");
  }

  const activeCollaborators = [
    ...document.collaborators,
    ...presence
      .filter((user) => user.id !== localUser.id)
      .map((user) => ({
        ...user,
        isOnline: true,
      })),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-9">
      <article className="overflow-hidden rounded-md border border-line bg-panel shadow-sm">
        <header className="border-b border-line px-5 py-5 md:px-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <label className="sr-only" htmlFor="document-title">
                Document title
              </label>
              <input
                id="document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-transparent bg-transparent px-0 text-3xl font-semibold tracking-normal text-ink transition focus:border-line focus:bg-canvas focus:px-2 md:text-4xl"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2.5 text-sm text-soft">
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={15} />
                  Updated {relativeTime(document.updatedAt)}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {document.status}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {isSynced ? "Editor synced" : "Opening editor"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AvatarStack collaborators={activeCollaborators} />
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteDocument.isPending}
                className="grid h-9 w-9 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-accent disabled:cursor-not-allowed disabled:opacity-55"
                aria-label="Delete document"
                title="Delete document"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasTitleChanges || updateDocument.isPending}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-semibold text-panel transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {hasTitleChanges ? <Save size={16} /> : <Check size={16} />}
                {updateDocument.isPending
                  ? "Saving"
                  : hasTitleChanges
                    ? "Save"
                    : "Saved"}
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-4 bg-canvas/55 px-4 py-4 md:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <EditorToolbar editor={editor} />

            <div className="flex flex-wrap gap-2">
              {document.tags.length ? (
                document.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-soft"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-sm text-soft">No tags yet</span>
              )}
            </div>
          </div>

          <EditorContent editor={editor} />
        </div>
      </article>
    </div>
  );
}

export function DocumentPage() {
  const { documentId } = useParams();
  const { data: document, isError, isLoading } = useDocument(documentId);

  if (!documentId) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="h-[70vh] animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  if (isError || !document) {
    return (
      <div className="mx-auto w-full max-w-5xl p-6">
        <div className="rounded-md border border-line bg-panel p-8 text-center">
          <h1 className="text-xl font-semibold">Document unavailable</h1>
          <p className="mt-2 text-sm text-soft">
            The selected document could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return <DocumentEditor document={document} />;
}
