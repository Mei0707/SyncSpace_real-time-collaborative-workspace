import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  MailPlus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import type { WorkspaceMember, WorkspaceRole } from "../data/types";
import { useAuth } from "../hooks/authContext";
import {
  useInviteMember,
  useRemoveMember,
  useTeam,
  useUpdateMemberRole,
} from "../hooks/useTeam";
import { relativeTime } from "../lib/date";

const inviteRoles: Array<Exclude<WorkspaceRole, "owner">> = [
  "editor",
  "viewer",
  "admin",
];
const allRoles: WorkspaceRole[] = ["owner", "admin", "editor", "viewer"];

function canManage(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function canEditMember(actorRole: WorkspaceRole, member: WorkspaceMember) {
  if (!canManage(actorRole)) {
    return false;
  }

  if (member.role === "owner" && actorRole !== "owner") {
    return false;
  }

  return true;
}

export function TeamPage() {
  const { user } = useAuth();
  const { data, isLoading } = useTeam();
  const inviteMember = useInviteMember();
  const updateMemberRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<WorkspaceRole, "owner">>("editor");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentRole = data?.currentUserRole ?? "viewer";
  const isManager = canManage(currentRole);
  const ownerCount = useMemo(
    () => data?.members.filter((member) => member.role === "owner").length ?? 0,
    [data?.members],
  );

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const invitation = await inviteMember.mutateAsync({ email, role });
      setEmail("");
      setMessage(
        invitation.status === "accepted"
          ? "Existing user added to the workspace."
          : "Invitation created. The user will join when they register.",
      );
    } catch (inviteError) {
      setError(
        inviteError instanceof Error ? inviteError.message : "Could not invite member.",
      );
    }
  }

  async function handleRoleChange(member: WorkspaceMember, nextRole: WorkspaceRole) {
    setError(null);
    setMessage(null);

    try {
      await updateMemberRole.mutateAsync({
        userId: member.id,
        role: nextRole,
      });
      setMessage(`${member.name} is now ${nextRole}.`);
    } catch (roleError) {
      setError(
        roleError instanceof Error ? roleError.message : "Could not update role.",
      );
    }
  }

  async function handleRemove(member: WorkspaceMember) {
    setError(null);
    setMessage(null);

    try {
      await removeMember.mutateAsync(member.id);
      setMessage(`${member.name} was removed from the workspace.`);
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "Could not remove member.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 md:px-6 md:py-6">
      <section className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Team</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-soft">
            Manage workspace access, roles, and pending invitations.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm">
          <ShieldCheck size={16} className="text-brand" />
          <span className="font-semibold capitalize">{currentRole}</span>
        </div>
      </section>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-3 py-2 text-sm text-accent">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-good/30 bg-good/8 px-3 py-2 text-sm text-good">
          {message}
        </div>
      ) : null}

      {isManager ? (
        <form
          onSubmit={handleInvite}
          className="grid gap-3 rounded-xl border border-line bg-panel p-4 md:grid-cols-[1fr_11rem_auto]"
        >
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase text-soft">
              Invite by email
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm"
              placeholder="teammate@example.com"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase text-soft">
              Role
            </span>
            <select
              value={role}
              aria-label="Invite role"
              onChange={(event) =>
                setRole(event.target.value as Exclude<WorkspaceRole, "owner">)
              }
              className="h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm capitalize"
            >
              {inviteRoles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={inviteMember.isPending}
            className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-panel transition hover:bg-ink/90 disabled:opacity-60"
          >
            <MailPlus size={16} />
            Invite
          </button>
        </form>
      ) : (
        <div className="rounded-xl border border-line bg-panel p-4 text-sm text-soft">
          You can view members, but role management requires admin access.
        </div>
      )}

      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Members</h2>
          <span className="text-sm text-soft">{data?.members.length ?? 0}</span>
        </div>
        <div className="divide-y divide-line">
          {data?.members.map((member) => {
            const isSelf = member.id === user?.id;
            const editable = canEditMember(currentRole, member);
            const cannotRemoveLastOwner =
              member.role === "owner" && ownerCount <= 1;

            return (
              <div
                key={member.id}
                data-testid="member-row"
                className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_11rem_8rem]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {member.name} {isSelf ? "(you)" : ""}
                    </p>
                    <p className="truncate text-xs text-soft">{member.email}</p>
                    <p className="mt-1 text-[11px] text-soft">
                      Joined {relativeTime(member.joinedAt)}
                    </p>
                  </div>
                </div>
                <select
                  value={member.role}
                  onChange={(event) =>
                    void handleRoleChange(
                      member,
                      event.target.value as WorkspaceRole,
                    )
                  }
                  disabled={!editable || updateMemberRole.isPending}
                  className="h-9 rounded-md border border-line bg-canvas px-2 text-sm capitalize disabled:opacity-60"
                  aria-label={`Change ${member.name} role`}
                >
                  {allRoles
                    .filter((item) => currentRole === "owner" || item !== "owner")
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleRemove(member)}
                  disabled={
                    !editable ||
                    isSelf ||
                    cannotRemoveLastOwner ||
                    removeMember.isPending
                  }
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm text-soft transition hover:bg-muted hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {isManager ? (
        <section className="rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold">Invitations</h2>
            <span className="text-sm text-soft">
              {data?.invitations.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-line">
            {data?.invitations.length ? (
              data.invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  data-testid="invitation-row"
                  className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_8rem_8rem]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-soft">
                      <UserRound size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {invitation.email}
                      </p>
                      <p className="mt-1 text-xs text-soft">
                        Invited {relativeTime(invitation.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="h-8 rounded-md border border-line bg-canvas px-2 py-1 text-center text-sm capitalize text-soft">
                    {invitation.role}
                  </span>
                  <span className="h-8 rounded-md border border-line bg-canvas px-2 py-1 text-center text-sm capitalize text-soft">
                    {invitation.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-soft">
                No invitations yet.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
