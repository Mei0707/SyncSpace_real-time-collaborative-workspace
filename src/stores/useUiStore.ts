import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";
export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface UiState {
  isSidebarOpen: boolean;
  theme: ThemeMode;
  connectionStatus: ConnectionStatus;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleTheme: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      theme: "light",
      connectionStatus: "connected",
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
    }),
    {
      name: "syncspace-ui",
      partialize: (state) => ({
        theme: state.theme,
        isSidebarOpen: state.isSidebarOpen,
      }),
    },
  ),
);
