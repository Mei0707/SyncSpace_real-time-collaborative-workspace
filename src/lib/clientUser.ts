const names = ["Maya", "Owen", "Priya", "Noah", "Avery", "Jordan", "Sam", "Riley"];
const colors = ["#1a735c", "#2962ff", "#b36b00", "#8b5cf6", "#c2410c", "#0f766e"];

export interface LocalUser {
  id: string;
  name: string;
  color: string;
}

export function getLocalUser(): LocalUser {
  const stored = window.localStorage.getItem("syncspace-user");

  if (stored) {
    return JSON.parse(stored) as LocalUser;
  }

  const index = Math.floor(Math.random() * names.length);
  const user: LocalUser = {
    id: crypto.randomUUID(),
    name: `${names[index]} ${Math.floor(100 + Math.random() * 900)}`,
    color: colors[index % colors.length],
  };

  window.localStorage.setItem("syncspace-user", JSON.stringify(user));
  return user;
}
