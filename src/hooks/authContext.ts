import { createContext, useContext } from "react";
import type { AuthUser } from "../data/authApi";

export interface AuthContextValue {
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
