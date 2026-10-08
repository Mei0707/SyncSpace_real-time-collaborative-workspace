import type { Collaborator } from "../data/types";

export function AvatarStack({ collaborators }: { collaborators: Collaborator[] }) {
  if (collaborators.length === 0) {
    return <span className="text-xs text-soft">No collaborators</span>;
  }

  return (
    <div className="flex items-center">
      {collaborators.slice(0, 4).map((collaborator, index) => (
        <span
          key={collaborator.id}
          title={collaborator.name}
          className="grid h-7 w-7 place-items-center rounded-full border-2 border-panel text-[10px] font-semibold text-white shadow-sm"
          style={{
            backgroundColor: collaborator.color,
            marginLeft: index === 0 ? 0 : -7,
            zIndex: collaborators.length - index,
          }}
        >
          {collaborator.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </span>
      ))}
    </div>
  );
}
