import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Undo2,
} from "lucide-react";
import { cn } from "../lib/cn";

interface ToolbarButtonProps {
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}

function ToolbarButton({
  label,
  isActive,
  disabled,
  icon,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md text-soft transition hover:bg-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-45",
        isActive && "bg-muted text-brand",
      )}
    >
      {icon}
    </button>
  );
}

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-panel p-1 shadow-sm"
      aria-label="Editor tools"
    >
      <ToolbarButton
        label="Heading 1"
        icon={<Heading1 size={17} />}
        isActive={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolbarButton
        label="Heading 2"
        icon={<Heading2 size={17} />}
        isActive={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolbarButton
        label="Bold"
        icon={<Bold size={17} />}
        isActive={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Italic"
        icon={<Italic size={17} />}
        isActive={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Bullet list"
        icon={<List size={17} />}
        isActive={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="Ordered list"
        icon={<ListOrdered size={17} />}
        isActive={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Code block"
        icon={<Code size={17} />}
        isActive={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <div className="mx-1 h-6 w-px bg-line" />
      <ToolbarButton
        label="Undo"
        icon={<Undo2 size={17} />}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="Redo"
        icon={<Redo2 size={17} />}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}
