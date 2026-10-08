import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  Check,
  Copy,
  FileText,
  GripVertical,
  List,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Radio,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AvatarStack } from "../components/AvatarStack";
import type {
  DocumentStatus,
  WorkspaceDocument,
  WorkspaceRole,
  WorkspaceActivity,
} from "../data/types";
import { useAuth } from "../hooks/authContext";
import {
  useCreateDocument,
  useDeleteDocument,
  useDuplicateDocument,
  useUpdateDocument,
  useWorkspace,
} from "../hooks/useWorkspace";
import { useWorkspaceActivity } from "../hooks/useWorkspaceFeatures";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/date";

const columns: Array<{
  id: DocumentStatus;
  title: string;
  tint: string;
  accent: string;
}> = [
  {
    id: "draft",
    title: "Draft",
    tint: "bg-muted/55",
    accent: "bg-soft",
  },
  {
    id: "review",
    title: "In Review",
    tint: "bg-brand/8",
    accent: "bg-brand",
  },
  {
    id: "published",
    title: "Published",
    tint: "bg-good/8",
    accent: "bg-good",
  },
];

const statusLabels = new Map(columns.map((column) => [column.id, column.title]));
type DashboardView = "board" | "list" | "activity";

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

interface DocumentBoardCardProps {
  document: WorkspaceDocument;
  canDelete: boolean;
  canEdit: boolean;
  isMenuOpen: boolean;
  onDelete: (document: WorkspaceDocument) => void;
  onDuplicate: (document: WorkspaceDocument) => void;
  onRename: (document: WorkspaceDocument) => void;
  onStatusChange: (document: WorkspaceDocument, status: DocumentStatus) => void;
  onToggleMenu: (documentId: string) => void;
}

function DocumentBoardCard({
  document,
  canDelete,
  canEdit,
  isMenuOpen,
  onDelete,
  onDuplicate,
  onRename,
  onStatusChange,
  onToggleMenu,
}: DocumentBoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: document.id,
      data: { status: document.status },
      disabled: !canEdit,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.58 : 1,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-xl border border-line bg-panel p-4 shadow-[0_8px_22px_rgb(15_23_42/0.07)] transition",
        "hover:-translate-y-0.5 hover:border-brand/45 hover:shadow-[0_14px_30px_rgb(15_23_42/0.11)]",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3 text-xs text-soft">
        <span className="inline-flex items-center gap-1.5 pt-1">
          <CalendarDays size={13} />
          {relativeTime(document.updatedAt)}
        </span>
        {canEdit || canDelete ? (
          <div className="flex items-center gap-1">
            {canEdit ? (
              <button
                type="button"
                className="grid h-7 w-7 cursor-grab place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink active:cursor-grabbing"
                aria-label={`Drag ${document.title}`}
                {...attributes}
                {...listeners}
              >
                <GripVertical size={14} />
              </button>
            ) : null}
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
              aria-label={`Open ${document.title} menu`}
              onClick={() => onToggleMenu(document.id)}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        ) : null}
      </div>

      {isMenuOpen ? (
        <div
          role="menu"
          className="absolute right-3 top-12 z-30 w-52 rounded-xl border border-line bg-panel p-1.5 shadow-xl"
        >
          {canEdit ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => onRename(document)}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition hover:bg-muted"
              >
                <Pencil size={14} />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => onDuplicate(document)}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition hover:bg-muted"
              >
                <Copy size={14} />
                Duplicate
              </button>
              <div className="my-1 border-t border-line" />
              <p className="px-2.5 py-1 text-[11px] font-semibold uppercase text-soft">
                Status
              </p>
              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={document.status === column.id}
                  onClick={() => onStatusChange(document, column.id)}
                  className="flex h-8 w-full items-center justify-between rounded-md px-2.5 text-left text-sm transition hover:bg-muted"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", column.accent)} />
                    {column.title}
                  </span>
                  {document.status === column.id ? <Check size={14} /> : null}
                </button>
              ))}
            </>
          ) : null}
          {canEdit && canDelete ? <div className="my-1 border-t border-line" /> : null}
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => onDelete(document)}
              className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm text-accent transition hover:bg-accent/10"
            >
              <Trash2 size={14} />
              Delete
            </button>
          ) : null}
        </div>
      ) : null}

      <Link to={`/documents/${document.id}`}>
        <h3 className="text-base font-semibold transition group-hover:text-brand">
          {document.title}
        </h3>
      </Link>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-soft">
        {document.summary}
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <AvatarStack collaborators={document.collaborators} />
        <span className="rounded-md border border-line bg-canvas px-2 py-0.5 text-[11px] text-soft">
          {statusLabels.get(document.status)}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-1 border-t border-line pt-3">
        {document.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-line bg-canvas px-2 py-0.5 text-[11px] text-soft"
          >
            #{tag}
          </span>
        ))}
      </div>
    </article>
  );
}

interface BoardColumnProps {
  column: (typeof columns)[number];
  documents: WorkspaceDocument[];
  canDeleteDocument: (document: WorkspaceDocument) => boolean;
  canEdit: boolean;
  isCreating: boolean;
  openMenuId: string | null;
  onCreateDocument: () => void;
  onDelete: (document: WorkspaceDocument) => void;
  onDuplicate: (document: WorkspaceDocument) => void;
  onRename: (document: WorkspaceDocument) => void;
  onStatusChange: (document: WorkspaceDocument, status: DocumentStatus) => void;
  onToggleMenu: (documentId: string) => void;
}

function BoardColumn({
  column,
  documents,
  canDeleteDocument,
  canEdit,
  isCreating,
  openMenuId,
  onCreateDocument,
  onDelete,
  onDuplicate,
  onRename,
  onStatusChange,
  onToggleMenu,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "min-h-[28rem] rounded-[18px] border border-line p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.58)] transition dark:shadow-none",
        column.tint,
        isOver ? "ring-2 ring-brand/35" : "",
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-semibold">
          <span className={cn("h-2.5 w-2.5 rounded-full", column.accent)} />
          {column.title}
        </h2>
        <span className="rounded-full border border-line/70 bg-panel px-2 py-0.5 text-xs text-soft">
          {documents.length}
        </span>
      </div>
      <div className="space-y-3">
        {documents.length > 0 ? (
          documents.map((document) => (
            <DocumentBoardCard
              key={document.id}
              document={document}
              canDelete={canDeleteDocument(document)}
              canEdit={canEdit}
              isMenuOpen={openMenuId === document.id}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onRename={onRename}
              onStatusChange={onStatusChange}
              onToggleMenu={onToggleMenu}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-panel/60 px-4 py-8 text-center text-sm text-soft">
            No documents
          </div>
        )}
      </div>
      {canEdit ? (
        <button
          type="button"
          onClick={onCreateDocument}
          disabled={isCreating}
          className="mt-4 inline-flex items-center gap-2 text-sm text-soft transition hover:text-ink disabled:opacity-50"
        >
          <span className="grid h-5 w-5 place-items-center rounded-full bg-panel text-xs">
            +
          </span>
          Add document
        </button>
      ) : (
        <p className="mt-4 text-sm text-soft">Read-only</p>
      )}
    </section>
  );
}

function RenameDialog({
  document,
  isSaving,
  value,
  onCancel,
  onChange,
  onSubmit,
}: {
  document: WorkspaceDocument | null;
  isSaving: boolean;
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!document) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-title"
        className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="rename-title" className="text-lg font-semibold">
              Rename document
            </h2>
            <p className="mt-1 text-sm text-soft">{document.title}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
            aria-label="Close rename dialog"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mt-5 block">
          <span className="mb-2 block text-xs font-semibold uppercase text-soft">
            Title
          </span>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm"
            autoFocus
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-line px-3 text-sm font-medium transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !value.trim()}
            className="h-9 rounded-md bg-ink px-3 text-sm font-semibold text-panel transition hover:bg-ink/90 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteDialog({
  document,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  document: WorkspaceDocument | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!document) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="w-full max-w-md rounded-xl border border-line bg-panel p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
            <Trash2 size={18} />
          </span>
          <div>
            <h2 id="delete-title" className="text-lg font-semibold">
              Delete document
            </h2>
            <p className="mt-1 text-sm leading-6 text-soft">
              Delete "{document.title}"? This cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-line px-3 text-sm font-medium transition hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-9 rounded-md bg-accent px-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentListView({
  documents,
  canEdit,
  onStatusChange,
}: {
  documents: WorkspaceDocument[];
  canEdit: boolean;
  onStatusChange: (document: WorkspaceDocument, status: DocumentStatus) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-panel">
      <div className="grid grid-cols-[1fr_8rem_9rem] gap-3 border-b border-line px-4 py-3 text-xs font-semibold uppercase text-soft md:grid-cols-[1fr_9rem_10rem_9rem]">
        <span>Document</span>
        <span>Status</span>
        <span className="hidden md:block">Updated</span>
        <span>Owner</span>
      </div>
      <div className="divide-y divide-line">
        {documents.map((document) => (
          <div
            key={document.id}
            className="grid grid-cols-[1fr_8rem_9rem] gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_9rem_10rem_9rem]"
          >
            <Link
              to={`/documents/${document.id}`}
              className="min-w-0 font-semibold hover:text-brand"
            >
              <span className="block truncate">{document.title}</span>
              <span className="mt-1 block truncate text-xs font-normal text-soft">
                {document.summary}
              </span>
            </Link>
            {canEdit ? (
              <select
                value={document.status}
                onChange={(event) =>
                  onStatusChange(document, event.target.value as DocumentStatus)
                }
                className="h-8 rounded-md border border-line bg-canvas px-2 text-xs capitalize"
                aria-label={`Change ${document.title} status`}
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-soft">{statusLabels.get(document.status)}</span>
            )}
            <span className="hidden text-soft md:block">
              {relativeTime(document.updatedAt)}
            </span>
            <span className="truncate text-soft">{document.ownerId}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityFeed({ activity }: { activity: WorkspaceActivity[] }) {
  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <div className="space-y-3">
        {activity.length ? (
          activity.map((item) => (
            <Link
              key={item.id}
              to={item.documentId ? `/documents/${item.documentId}` : "/"}
              className="flex gap-3 rounded-md p-2 transition hover:bg-muted"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: item.actor.color }}
              >
                {item.actor.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.message}</span>
                <span className="mt-1 block text-xs text-soft">
                  {item.actor.name} · {relativeTime(item.createdAt)}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="py-10 text-center text-sm text-soft">
            Activity will appear as the team works.
          </p>
        )}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useWorkspace();
  const { user } = useAuth();
  const { data: activity = [] } = useWorkspaceActivity();
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();
  const duplicateDocument = useDuplicateDocument();
  const updateDocument = useUpdateDocument();
  const navigate = useNavigate();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );
  const documents = useMemo(() => data?.documents ?? [], [data?.documents]);
  const activeCollaborators = useMemo(
    () =>
      new Map(
        documents
          .flatMap((document) => document.collaborators)
          .filter((collaborator) => collaborator.isOnline)
          .map((collaborator) => [collaborator.id, collaborator]),
      ),
    [documents],
  );
  const [boardQuery, setBoardQuery] = useState("");
  const [activeView, setActiveView] = useState<DashboardView>("board");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingDocument, setRenamingDocument] =
    useState<WorkspaceDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingDocument, setDeletingDocument] =
    useState<WorkspaceDocument | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const workspaceRole = data?.currentUserRole ?? "viewer";
  const canEditWorkspace = canWrite(workspaceRole);
  const canDeleteFromWorkspace = (document: WorkspaceDocument) =>
    canDeleteDocument(workspaceRole, document, user?.id);

  const filteredDocuments = useMemo(() => {
    const search = boardQuery.trim().toLowerCase();

    return documents.filter((document) => {
      const matchesStatus =
        statusFilter === "all" || document.status === statusFilter;
      const matchesSearch =
        !search ||
        [
          document.title,
          document.summary,
          document.tags.join(" "),
          statusLabels.get(document.status),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [boardQuery, documents, statusFilter]);

  const visibleColumns =
    statusFilter === "all"
      ? columns
      : columns.filter((column) => column.id === statusFilter);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="h-40 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  async function handleCreateDocument() {
    if (!canEditWorkspace) {
      return;
    }

    setBoardError(null);
    const document = await createDocument.mutateAsync("Untitled document");
    navigate(`/documents/${document.id}`);
  }

  async function handleStatusChange(
    document: WorkspaceDocument,
    status: DocumentStatus,
  ) {
    if (!canEditWorkspace || document.status === status) {
      return;
    }

    setBoardError(null);
    setOpenMenuId(null);

    try {
      await updateDocument.mutateAsync({
        id: document.id,
        status,
      });
    } catch {
      setBoardError("Could not update the document status.");
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!canEditWorkspace) {
      return;
    }

    const document = documents.find((item) => item.id === event.active.id);
    const nextStatus = event.over?.id as DocumentStatus | undefined;

    if (!document || !nextStatus) {
      return;
    }

    if (!columns.some((column) => column.id === nextStatus)) {
      return;
    }

    await handleStatusChange(document, nextStatus);
  }

  function handleRenameRequest(document: WorkspaceDocument) {
    if (!canEditWorkspace) {
      return;
    }

    setBoardError(null);
    setOpenMenuId(null);
    setRenamingDocument(document);
    setRenameValue(document.title);
  }

  async function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!renamingDocument) {
      return;
    }

    const title = renameValue.trim();

    if (!title || title === renamingDocument.title) {
      setRenamingDocument(null);
      return;
    }

    setBoardError(null);

    try {
      await updateDocument.mutateAsync({
        id: renamingDocument.id,
        title,
      });
      setRenamingDocument(null);
    } catch {
      setBoardError("Could not rename the document.");
    }
  }

  async function handleDuplicate(document: WorkspaceDocument) {
    if (!canEditWorkspace) {
      return;
    }

    setBoardError(null);
    setOpenMenuId(null);

    try {
      const copy = await duplicateDocument.mutateAsync(document.id);
      navigate(`/documents/${copy.id}`);
    } catch {
      setBoardError("Could not duplicate the document.");
    }
  }

  function handleDeleteRequest(document: WorkspaceDocument) {
    if (!canDeleteFromWorkspace(document)) {
      return;
    }

    setBoardError(null);
    setOpenMenuId(null);
    setDeletingDocument(document);
  }

  async function handleConfirmDelete() {
    if (!deletingDocument) {
      return;
    }

    setBoardError(null);

    try {
      await deleteDocument.mutateAsync(deletingDocument.id);
      setDeletingDocument(null);
    } catch {
      setBoardError("Could not delete the document.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 md:px-6 md:py-6">
      {openMenuId ? (
        <button
          type="button"
          className="fixed inset-0 z-10 cursor-default"
          aria-label="Close document menu"
          onClick={() => setOpenMenuId(null)}
        />
      ) : null}

      <section className="rounded-[18px] bg-panel px-1 pb-2">
        <div className="flex flex-col gap-6 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-normal md:text-4xl">
              {data?.name}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-soft">
              {data?.description}
            </p>
          </div>

          <div className="grid min-w-[min(100%,28rem)] grid-cols-3 divide-x divide-line rounded-xl border border-line bg-canvas/75 shadow-sm">
            <div className="px-4 py-3">
              <FileText className="mb-2 text-brand" size={18} />
              <p className="text-2xl font-semibold">{documents.length}</p>
              <p className="text-xs text-soft">Docs</p>
            </div>
            <div className="px-4 py-3">
              <Users className="mb-2 text-accent" size={18} />
              <p className="text-2xl font-semibold">
                {activeCollaborators.size}
              </p>
              <p className="text-xs text-soft">Online</p>
            </div>
            <div className="px-4 py-3">
              <Radio className="mb-2 text-good" size={18} />
              <p className="text-2xl font-semibold">Live</p>
              <p className="text-xs text-soft">Sync</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_19rem]">
        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6 border-b border-line md:border-0">
              <button
                type="button"
                onClick={() => setActiveView("board")}
                className={cn(
                  "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold",
                  activeView === "board"
                    ? "border-brand text-brand"
                    : "border-transparent text-soft",
                )}
              >
                <Activity size={15} />
                Board
              </button>
              <button
                type="button"
                onClick={() => setActiveView("list")}
                className={cn(
                  "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold",
                  activeView === "list"
                    ? "border-brand text-brand"
                    : "border-transparent text-soft",
                )}
              >
                <List size={15} />
                List
              </button>
              <button
                type="button"
                onClick={() => setActiveView("activity")}
                className={cn(
                  "inline-flex h-10 items-center gap-2 border-b-2 px-1 text-sm font-semibold",
                  activeView === "activity"
                    ? "border-brand text-brand"
                    : "border-transparent text-soft",
                )}
              >
                <MessageSquare size={15} />
                Activity
              </button>
            </div>
            <div className="flex items-center gap-2">
              <AvatarStack collaborators={[...activeCollaborators.values()]} />
              <span className="h-9 rounded-md border border-line bg-canvas px-3 py-2 text-xs font-semibold capitalize text-soft">
                {workspaceRole}
              </span>
              <button
                type="button"
                className="h-9 rounded-md bg-ink px-3 text-sm font-semibold text-panel"
              >
                Invite
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-line bg-panel/95 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search board</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-soft"
                size={15}
              />
              <input
                value={boardQuery}
                onChange={(event) => setBoardQuery(event.target.value)}
                className="h-9 w-full rounded-md border border-line bg-canvas pl-9 pr-3 text-sm placeholder:text-soft/80"
                placeholder="Search board"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "h-9 rounded-md border px-3 text-sm font-medium transition",
                  statusFilter === "all"
                    ? "border-ink bg-ink text-panel"
                    : "border-line text-soft hover:bg-muted hover:text-ink",
                )}
              >
                All
              </button>
              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => setStatusFilter(column.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition",
                    statusFilter === column.id
                      ? "border-ink bg-ink text-panel"
                      : "border-line text-soft hover:bg-muted hover:text-ink",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", column.accent)} />
                  {column.title}
                </button>
              ))}
              {boardQuery || statusFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setBoardQuery("");
                    setStatusFilter("all");
                  }}
                  className="grid h-9 w-9 place-items-center rounded-md border border-line text-soft transition hover:bg-muted hover:text-ink"
                  aria-label="Clear board filters"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>
          </div>

          {boardError ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-3 py-2 text-sm text-accent">
              <AlertCircle size={16} />
              {boardError}
            </div>
          ) : null}

          {activeView === "board" ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div
                className={cn(
                  "grid gap-4",
                  visibleColumns.length === 1
                    ? "lg:grid-cols-[minmax(0,28rem)]"
                    : "lg:grid-cols-3",
                )}
              >
                {visibleColumns.map((column) => (
                  <BoardColumn
                    key={column.id}
                    column={column}
                    canDeleteDocument={canDeleteFromWorkspace}
                    canEdit={canEditWorkspace}
                    documents={filteredDocuments.filter(
                      (document) => document.status === column.id,
                    )}
                    openMenuId={openMenuId}
                    onCreateDocument={handleCreateDocument}
                    onDelete={handleDeleteRequest}
                    onDuplicate={handleDuplicate}
                    onRename={handleRenameRequest}
                    onStatusChange={handleStatusChange}
                    onToggleMenu={(documentId) =>
                      setOpenMenuId((current) =>
                        current === documentId ? null : documentId,
                      )
                    }
                    isCreating={createDocument.isPending}
                  />
                ))}
              </div>
            </DndContext>
          ) : null}

          {activeView === "list" ? (
            <DocumentListView
              documents={filteredDocuments}
              canEdit={canEditWorkspace}
              onStatusChange={handleStatusChange}
            />
          ) : null}

          {activeView === "activity" ? <ActivityFeed activity={activity} /> : null}
        </div>

        <aside className="space-y-5 rounded-[18px] border border-line bg-panel/95 p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase text-soft">
              Workspace pulse
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-canvas/80 p-3 shadow-sm">
                <p className="text-2xl font-semibold">
                  {activeCollaborators.size}
                </p>
                <p className="text-xs text-soft">Online now</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas/80 p-3 shadow-sm">
                <p className="text-2xl font-semibold">
                  {filteredDocuments.length}
                </p>
                <p className="text-xs text-soft">Visible docs</p>
              </div>
            </div>
          </div>

          <div className="border-t border-line pt-5">
            <h2 className="text-sm font-semibold">Team capacity</h2>
            <div className="mt-4 space-y-4">
              {[...activeCollaborators.values()].slice(0, 4).map((user, index) => (
                <div key={user.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
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
                    <span className="text-sm font-medium">{user.name}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${78 - index * 9}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-5">
            <h2 className="text-sm font-semibold">Recent mentions</h2>
            <div className="mt-4 space-y-4">
              {documents.slice(0, 3).map((document) => (
                <Link
                  key={document.id}
                  to={`/documents/${document.id}`}
                  className="block rounded-xl border border-transparent p-2 transition hover:border-line hover:bg-muted/50"
                >
                  <p className="text-sm font-medium">{document.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-soft">
                    {document.summary}
                  </p>
                  <p className="mt-2 text-[11px] text-soft">
                    {relativeTime(document.updatedAt)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <RenameDialog
        document={renamingDocument}
        value={renameValue}
        isSaving={updateDocument.isPending}
        onChange={setRenameValue}
        onCancel={() => setRenamingDocument(null)}
        onSubmit={handleRenameSubmit}
      />
      <DeleteDialog
        document={deletingDocument}
        isDeleting={deleteDocument.isPending}
        onCancel={() => setDeletingDocument(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
