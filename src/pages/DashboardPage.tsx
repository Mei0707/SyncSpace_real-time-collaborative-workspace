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
  CalendarDays,
  Copy,
  FileText,
  GripVertical,
  List,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Radio,
  Trash2,
  Users,
} from "lucide-react";
import { AvatarStack } from "../components/AvatarStack";
import type { DocumentStatus, WorkspaceDocument } from "../data/types";
import {
  useCreateDocument,
  useDeleteDocument,
  useDuplicateDocument,
  useUpdateDocument,
  useWorkspace,
} from "../hooks/useWorkspace";
import { relativeTime } from "../lib/date";

const columns: Array<{
  id: DocumentStatus;
  title: string;
  tint: string;
}> = [
  { id: "draft", title: "Draft", tint: "bg-accent/8" },
  { id: "review", title: "In Review", tint: "bg-brand/8" },
  { id: "published", title: "Published", tint: "bg-good/8" },
];

interface DocumentBoardCardProps {
  document: WorkspaceDocument;
  onDelete: (document: WorkspaceDocument) => void;
  onDuplicate: (document: WorkspaceDocument) => void;
  onRename: (document: WorkspaceDocument) => void;
  onStatusChange: (document: WorkspaceDocument, status: DocumentStatus) => void;
}

function DocumentBoardCard({
  document,
  onDelete,
  onDuplicate,
  onRename,
  onStatusChange,
}: DocumentBoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: document.id,
      data: { status: document.status },
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
      className="group rounded-xl border border-line bg-panel p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-soft">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={13} />
          {relativeTime(document.updatedAt)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid h-7 w-7 cursor-grab place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink active:cursor-grabbing"
            aria-label={`Drag ${document.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </button>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
            aria-label={`Rename ${document.title}`}
            title="Rename"
            onClick={() => onRename(document)}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink"
            aria-label={`Duplicate ${document.title}`}
            title="Duplicate"
            onClick={() => onDuplicate(document)}
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-accent"
            aria-label={`Delete ${document.title}`}
            title="Delete"
            onClick={() => onDelete(document)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
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
        <div className="flex flex-wrap justify-end gap-1">
          {document.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-line bg-canvas px-2 py-0.5 text-[11px] text-soft"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <select
          value={document.status}
          onChange={(event) =>
            onStatusChange(document, event.target.value as DocumentStatus)
          }
          className="h-7 rounded-md border border-line bg-canvas px-2 text-xs text-soft"
          aria-label={`Change ${document.title} status`}
        >
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>
        <MoreHorizontal size={15} className="text-soft" />
      </div>
    </article>
  );
}

interface BoardColumnProps {
  column: (typeof columns)[number];
  documents: WorkspaceDocument[];
  onCreateDocument: () => void;
  onDelete: (document: WorkspaceDocument) => void;
  onDuplicate: (document: WorkspaceDocument) => void;
  onRename: (document: WorkspaceDocument) => void;
  onStatusChange: (document: WorkspaceDocument, status: DocumentStatus) => void;
  isCreating: boolean;
}

function BoardColumn({
  column,
  documents,
  onCreateDocument,
  onDelete,
  onDuplicate,
  onRename,
  onStatusChange,
  isCreating,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-[28rem] rounded-[18px] border border-line ${column.tint} p-4 transition ${
        isOver ? "ring-2 ring-brand/35" : ""
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{column.title}</h2>
        <span className="rounded-full bg-panel px-2 py-0.5 text-xs text-soft">
          {documents.length}
        </span>
      </div>
      <div className="space-y-3">
        {documents.map((document) => (
          <DocumentBoardCard
            key={document.id}
            document={document}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onRename={onRename}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>
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
    </section>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useWorkspace();
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
  const documents = data?.documents ?? [];
  const activeCollaborators = new Map(
    data?.documents
      .flatMap((document) => document.collaborators)
      .filter((collaborator) => collaborator.isOnline)
      .map((collaborator) => [collaborator.id, collaborator]) ?? [],
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="h-40 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  async function handleCreateDocument() {
    const document = await createDocument.mutateAsync("Untitled document");
    navigate(`/documents/${document.id}`);
  }

  async function handleStatusChange(
    document: WorkspaceDocument,
    status: DocumentStatus,
  ) {
    if (document.status === status) {
      return;
    }

    await updateDocument.mutateAsync({
      id: document.id,
      status,
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
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

  async function handleRename(document: WorkspaceDocument) {
    const title = window.prompt("Rename document", document.title);

    if (!title || title.trim() === document.title) {
      return;
    }

    await updateDocument.mutateAsync({
      id: document.id,
      title: title.trim(),
    });
  }

  async function handleDuplicate(document: WorkspaceDocument) {
    const copy = await duplicateDocument.mutateAsync(document.id);
    navigate(`/documents/${copy.id}`);
  }

  async function handleDelete(document: WorkspaceDocument) {
    const confirmed = window.confirm(
      `Delete "${document.title}"? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    await deleteDocument.mutateAsync(document.id);
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 md:px-6 md:py-6">
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

          <div className="grid min-w-[min(100%,28rem)] grid-cols-3 divide-x divide-line rounded-xl border border-line bg-canvas/60">
            <div className="px-4 py-3">
              <FileText className="mb-2 text-brand" size={18} />
              <p className="text-2xl font-semibold">
                {documents.length}
              </p>
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
                className="inline-flex h-10 items-center gap-2 border-b-2 border-brand px-1 text-sm font-semibold text-brand"
              >
                <Activity size={15} />
                Board
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 px-1 text-sm text-soft"
              >
                <List size={15} />
                List
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 px-1 text-sm text-soft"
              >
                <MessageSquare size={15} />
                Activity
              </button>
            </div>
            <div className="flex items-center gap-2">
              <AvatarStack collaborators={[...activeCollaborators.values()]} />
              <button
                type="button"
                className="h-9 rounded-md bg-ink px-3 text-sm font-semibold text-panel"
              >
                Invite
              </button>
            </div>
          </div>

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid gap-4 lg:grid-cols-3">
              {columns.map((column) => (
                <BoardColumn
                  key={column.id}
                  column={column}
                  documents={documents.filter(
                    (document) => document.status === column.id,
                  )}
                  onCreateDocument={handleCreateDocument}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onRename={handleRename}
                  onStatusChange={handleStatusChange}
                  isCreating={createDocument.isPending}
                />
              ))}
            </div>
          </DndContext>
        </div>

        <aside className="space-y-5 rounded-[18px] border border-line bg-panel p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-soft">
              Workspace pulse
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line bg-canvas/70 p-3">
                <p className="text-2xl font-semibold">{activeCollaborators.size}</p>
                <p className="text-xs text-soft">Online now</p>
              </div>
              <div className="rounded-xl border border-line bg-canvas/70 p-3">
                <p className="text-2xl font-semibold">92%</p>
                <p className="text-xs text-soft">Sync health</p>
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
    </div>
  );
}
