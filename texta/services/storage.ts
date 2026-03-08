import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const isWeb = Platform.OS === "web";

export const getItem = async (key: string): Promise<string | null> => {
    if (isWeb) {
        return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
};

export const setItem = async (key: string, value: string): Promise<void> => {
    if (isWeb) {
        localStorage.setItem(key, value);
        return;
    }
    await SecureStore.setItemAsync(key, value);
};

export const deleteItem = async (key: string): Promise<void> => {
    if (isWeb) {
        localStorage.removeItem(key);
        return;
    }
    await SecureStore.deleteItemAsync(key);
};
