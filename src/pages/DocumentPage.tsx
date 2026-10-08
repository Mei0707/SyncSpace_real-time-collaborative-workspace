import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { EditorContent } from "@tiptap/react";
import {
  Check,
  Clock,
  Download,
  History,
  MessageSquare,
  Paperclip,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AvatarStack } from "../components/AvatarStack";
import { EditorToolbar } from "../components/EditorToolbar";
import type { WorkspaceDocument, WorkspaceRole } from "../data/types";
import { useAuth } from "../hooks/authContext";
import { useCollaborativeDocument } from "../hooks/useCollaborativeDocument";
import {
  useDeleteDocument,
  useDocument,
  useUpdateDocument,
  useWorkspace,
} from "../hooks/useWorkspace";
import {
  useCreateDocumentAttachment,
  useCreateDocumentComment,
  useDeleteDocumentAttachment,
  useDocumentAttachments,
  useDocumentComments,
  useDocumentHistory,
} from "../hooks/useWorkspaceFeatures";
import { relativeTime } from "../lib/date";

function canWrite(role: WorkspaceRole) {
  return role === "owner" || role === "admin" || role === "editor";
}

function canDeleteDocument(
  role: WorkspaceRole,
  document: WorkspaceDocument,
  userId: string | undefined,
) {
  return role === "owner" || role === "admin" || document.ownerId === userId;
}

function DocumentEditor({
  document,
  workspaceRole,
}: {
  document: WorkspaceDocument;
  workspaceRole: WorkspaceRole;
}) {
  const { user } = useAuth();
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const createComment = useCreateDocumentComment();
  const createAttachment = useCreateDocumentAttachment();
  const deleteAttachment = useDeleteDocumentAttachment(document.id);
  const { data: comments = [] } = useDocumentComments(document.id);
  const { data: attachments = [] } = useDocumentAttachments(document.id);
  const { data: history = [] } = useDocumentHistory(document.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [sidePanel, setSidePanel] = useState<"comments" | "files" | "history">(
    "comments",
  );
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const { editor, isSynced, localUser, presence } = useCollaborativeDocument(
    document.id,
    document.content,
  );
  const canEdit = canWrite(workspaceRole);
  const canDelete = canDeleteDocument(workspaceRole, document, user?.id);

  useEffect(() => {
    setTitle(document.title);
  }, [document]);

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [canEdit, editor]);

  const hasTitleChanges = useMemo(() => {
    return document.title !== title;
  }, [document.title, title]);

  async function handleSave() {
    if (!canEdit || !hasTitleChanges) {
      return;
    }

    await updateDocument.mutateAsync({
      id: document.id,
      title,
      content: editor?.getText() ?? document.content,
      summary: (editor?.getText() ?? document.content).slice(0, 120),
    });
  }

  async function handleConfirmDelete() {
    if (!canDelete) {
      return;
    }

    await deleteDocument.mutateAsync(document.id);
    navigate("/");
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!commentBody.trim()) {
      return;
    }

    setPanelError(null);

    try {
      await createComment.mutateAsync({
        documentId: document.id,
        body: commentBody,
      });
      setCommentBody("");
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Could not add comment.");
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPanelError(null);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)));
        reader.addEventListener("error", () => reject(reader.error));
        reader.readAsDataURL(file);
      });

      await createAttachment.mutateAsync({
        documentId: document.id,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
      });
      event.target.value = "";
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "Could not upload file.");
    }
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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-9">
      <article className="overflow-hidden rounded-xl border border-line bg-panel shadow-[0_12px_34px_rgb(15_23_42/0.08)]">
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
                disabled={!canEdit}
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
                <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize">
                  {workspaceRole}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AvatarStack collaborators={activeCollaborators} />
              {canDelete ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  disabled={deleteDocument.isPending}
                  className="grid h-9 w-9 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-accent disabled:cursor-not-allowed disabled:opacity-55"
                  aria-label="Delete document"
                  title="Delete document"
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
              {canEdit ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasTitleChanges || updateDocument.isPending}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3.5 text-sm font-semibold text-panel shadow-sm transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {hasTitleChanges ? <Save size={16} /> : <Check size={16} />}
                  {updateDocument.isPending
                    ? "Saving"
                    : hasTitleChanges
                      ? "Save"
                      : "Saved"}
                </button>
              ) : (
                <span className="rounded-md border border-line px-3 py-2 text-sm text-soft">
                  Read-only
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="space-y-4 bg-canvas/55 px-4 py-4 md:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {canEdit ? (
              <EditorToolbar editor={editor} />
            ) : (
              <p className="text-sm text-soft">Viewing with read-only access.</p>
            )}

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

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_24rem]">
        <div className="rounded-xl border border-line bg-panel/95 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              ["comments", MessageSquare, `Comments ${comments.length}`],
              ["files", Paperclip, `Files ${attachments.length}`],
              ["history", History, `History ${history.length}`],
            ].map(([id, Icon, label]) => (
              <button
                key={String(id)}
                type="button"
                onClick={() => setSidePanel(id as "comments" | "files" | "history")}
                className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${
                  sidePanel === id
                    ? "border-ink bg-ink text-panel"
                    : "border-line text-soft hover:bg-muted hover:text-ink"
                }`}
              >
                <Icon size={15} />
                {String(label)}
              </button>
            ))}
          </div>

          {panelError ? (
            <div className="mb-3 rounded-md border border-accent/30 bg-accent/8 px-3 py-2 text-sm text-accent">
              {panelError}
            </div>
          ) : null}

          {sidePanel === "comments" ? (
            <div className="space-y-4">
              <form onSubmit={handleCommentSubmit} className="space-y-2">
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  className="min-h-24 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm"
                  placeholder="Comment or mention someone with @email@example.com"
                />
                <button
                  type="submit"
                  disabled={createComment.isPending || !commentBody.trim()}
                  className="h-9 rounded-md bg-ink px-3 text-sm font-semibold text-panel shadow-sm disabled:opacity-60"
                >
                  Add comment
                </button>
              </form>
              <div className="space-y-3">
                {comments.length ? (
                  comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-md border border-line bg-canvas/80 p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white"
                          style={{ backgroundColor: comment.author.color }}
                        >
                          {comment.author.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">
                            {comment.author.name}
                          </p>
                          <p className="text-xs text-soft">
                            {relativeTime(comment.createdAt)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-soft">
                        {comment.body}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-soft">
                    No comments yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {sidePanel === "files" ? (
            <div className="space-y-4">
              {canEdit ? (
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-ink px-3 text-sm font-semibold text-panel shadow-sm">
                  <Upload size={15} />
                  Upload file
                  <input type="file" className="sr-only" onChange={handleFileUpload} />
                </label>
              ) : null}
              <div className="space-y-2">
                {attachments.length ? (
                  attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-line bg-canvas/80 p-3 shadow-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-soft">
                          {Math.max(1, Math.round(attachment.size / 1024))} KB ·{" "}
                          {relativeTime(attachment.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <a
                          href={attachment.dataUrl}
                          download={attachment.name}
                          className="grid h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
                          aria-label={`Download ${attachment.name}`}
                        >
                          <Download size={15} />
                        </a>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() =>
                              void deleteAttachment.mutateAsync(attachment.id)
                            }
                            className="grid h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-accent"
                            aria-label={`Delete ${attachment.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-soft">
                    No files attached.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {sidePanel === "history" ? (
            <div className="space-y-3">
              {history.length ? (
                history.map((version) => (
                  <article
                    key={version.id}
                    className="rounded-md border border-line bg-canvas/80 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{version.title}</p>
                        <p className="text-xs text-soft">
                          {version.author.name} · {relativeTime(version.createdAt)}
                        </p>
                      </div>
                      <span className="rounded-md border border-line px-2 py-1 text-xs capitalize text-soft">
                        {version.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-soft">
                      {version.summary || version.content}
                    </p>
                  </article>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-soft">
                  History will appear after edits are saved.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <aside className="rounded-xl border border-line bg-panel/95 p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Document Workspace</h2>
          <div className="mt-4 space-y-3 text-sm text-soft">
            <p>Use comments for discussion and @email mentions.</p>
            <p>Attach files for context, references, and handoff material.</p>
            <p>History snapshots are captured when document metadata or content is saved.</p>
          </div>
        </aside>
      </section>

      {isDeleteOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-delete-title"
            className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
                  <Trash2 size={18} />
                </span>
                <div>
                  <h2 id="editor-delete-title" className="text-lg font-semibold">
                    Delete document
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-soft">
                    Delete "{document.title}"? This cannot be undone.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
                aria-label="Close delete dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="h-9 rounded-md border border-line px-3 text-sm font-medium transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteDocument.isPending}
                className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DocumentPage() {
  const { documentId } = useParams();
  const { data: document, isError, isLoading } = useDocument(documentId);
  const { data: workspace } = useWorkspace();

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

  return (
    <DocumentEditor
      document={document}
      workspaceRole={workspace?.currentUserRole ?? "viewer"}
    />
  );
}
