const MY_LIST_CODE_STORAGE_KEY = "smartroute:myListCode";

export function getMyListCode(): string | null {
  try {
    return window.localStorage.getItem(MY_LIST_CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setMyListCode(code: string): void {
  try {
    window.localStorage.setItem(MY_LIST_CODE_STORAGE_KEY, code);
  } catch {
    // Best-effort - a full/blocked localStorage just means the home widget won't work.
  }
}

export function clearMyListCode(): void {
  try {
    window.localStorage.removeItem(MY_LIST_CODE_STORAGE_KEY);
  } catch {
    // Best-effort, see setMyListCode.
  }
}
