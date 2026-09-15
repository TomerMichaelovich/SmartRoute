import AsyncStorage from "@react-native-async-storage/async-storage";

const MY_LIST_CODE_STORAGE_KEY = "smartroute:myListCode";

export async function getMyListCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(MY_LIST_CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setMyListCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(MY_LIST_CODE_STORAGE_KEY, code);
  } catch {
    // Best-effort - a blocked/full AsyncStorage just means the home widget won't work.
  }
}

export async function clearMyListCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(MY_LIST_CODE_STORAGE_KEY);
  } catch {
    // Best-effort, see setMyListCode.
  }
}
