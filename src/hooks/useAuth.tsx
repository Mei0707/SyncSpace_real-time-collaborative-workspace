import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { queryClient } from "../lib/queryClient";
import { clearAuthToken, getAuthToken, setAuthToken } from "../lib/authToken";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type AuthUser,
} from "../data/authApi";
import { AuthContext, type AuthContextValue } from "./authContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => getAuthToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(Boolean(token));
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isDisposed = false;

    async function loadUser() {
      if (!token) {
        setLoading(false);
        setUser(null);
        return;
      }

      setLoading(true);

      try {
        const response = await getCurrentUser();

        if (!isDisposed) {
          setUser(response.user);
          setError(null);
        }
      } catch (loadError) {
        if (!isDisposed) {
          setToken(null);
          setUser(null);
          setError(loadError instanceof Error ? loadError.message : null);
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      isDisposed = true;
    };
  }, [token]);

  const handleLogin = useCallback(async (input: { email: string; password: string }) => {
    setSubmitting(true);
    setError(null);

    try {
      const session = await loginRequest(input);
      setAuthToken(session.token);
      setToken(session.token);
      setUser(session.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
      throw loginError;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleRegister = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      setSubmitting(true);
      setError(null);

      try {
        const session = await registerRequest(input);
        setAuthToken(session.token);
        setToken(session.token);
        setUser(session.user);
      } catch (registerError) {
        setError(
          registerError instanceof Error
            ? registerError.message
            : "Registration failed",
        );
        throw registerError;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // The local session still needs to be cleared even if the API is gone.
    }

    clearAuthToken();
    setToken(null);
    setUser(null);
    setError(null);
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      isLoading,
      isSubmitting,
      token,
      user,
      login: handleLogin,
      register: handleRegister,
      logout: handleLogout,
    }),
    [
      error,
      handleLogin,
      handleLogout,
      handleRegister,
      isLoading,
      isSubmitting,
      token,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
