const names = ["Maya", "Owen", "Priya", "Noah", "Avery", "Jordan", "Sam", "Riley"];
const colors = ["#1a735c", "#2962ff", "#b36b00", "#8b5cf6", "#c2410c", "#0f766e"];

export interface LocalUser {
  id: string;
  name: string;
  color: string;
}

function createLocalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function getLocalUser(): LocalUser {
  const stored = window.localStorage.getItem("syncspace-user");

  if (stored) {
    try {
      return JSON.parse(stored) as LocalUser;
    } catch {
      window.localStorage.removeItem("syncspace-user");
    }
  }

  const index = Math.floor(Math.random() * names.length);
  const user: LocalUser = {
    id: createLocalId(),
    name: `${names[index]} ${Math.floor(100 + Math.random() * 900)}`,
    color: colors[index % colors.length],
  };

  window.localStorage.setItem("syncspace-user", JSON.stringify(user));
  return user;
}
