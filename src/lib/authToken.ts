const storageKey = "syncspace-auth-token";

export function getAuthToken() {
  return window.localStorage.getItem(storageKey);
}

export function setAuthToken(token: string) {
  window.localStorage.setItem(storageKey, token);
}

export function clearAuthToken() {
  window.localStorage.removeItem(storageKey);
}
