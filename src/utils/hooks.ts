import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { base64ToFile, fileToBase64 } from "./general";

// Type to mark base64 strings that should be converted back to Files
interface SerializedFile {
  __isFile: true;
  data: string;
  name: string;
  type: string;
}

// Helper function to recursively convert Files to serialized format in nested objects
async function convertFilesToSerialized(obj: any): Promise<any> {
  if (obj instanceof File) {
    const base64Data = await fileToBase64(obj);
    return {
      __isFile: true,
      data: base64Data,
      name: obj.name,
      type: obj.type,
    } as SerializedFile;
  }

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => convertFilesToSerialized(item)));
  }

  if (obj && typeof obj === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await convertFilesToSerialized(value);
    }
    return result;
  }

  return obj;
}

// Helper function to recursively convert serialized Files back to File objects
function convertSerializedToFiles(obj: any): any {
  // Check if this is a serialized File
  if (obj && typeof obj === "object" && obj.__isFile === true) {
    const serialized = obj as SerializedFile;
    return base64ToFile(serialized.data, serialized.name, serialized.type);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertSerializedToFiles(item));
  }

  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertSerializedToFiles(value);
    }
    return result;
  }

  return obj;
}

export function useLocalStorage<Type>(
  key: string,
  initialValue: Type,
): [Type, Dispatch<SetStateAction<Type>>] {
  // Always start with initialValue to match SSR — avoids hydration mismatch
  const [storedValue, setStoredValue] = useState<Type>(initialValue);

  // Read from localStorage only after mount (client-side)
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return;

      // If initial value is a string, return the raw item
      if (typeof initialValue === "string") {
        setStoredValue(item as Type);
      }
      // If initial value is a File, handle it as a serialized file
      else if (initialValue instanceof File) {
        try {
          const parsed = JSON.parse(item);
          if (parsed && parsed.__isFile) {
            setStoredValue(
              base64ToFile(parsed.data, parsed.name, parsed.type) as Type,
            );
          }
        } catch {
          setStoredValue(
            base64ToFile(
              item,
              initialValue.name || "file",
              initialValue.type || "application/octet-stream",
            ) as Type,
          );
        }
      }
      // Parse JSON and convert serialized Files back to File objects
      else {
        const parsed = JSON.parse(item);
        setStoredValue(convertSerializedToFiles(parsed) as Type);
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error);
    }
  }, []);

  const setValue = async (value: Type | ((prev: Type) => Type)) => {
    try {
      const valueToStore =
        typeof value === "function" ? (value as Function)(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        let storageValue: string;

        // Handle File objects
        if (valueToStore instanceof File) {
          const serialized = await convertFilesToSerialized(valueToStore);
          storageValue = JSON.stringify(serialized);
        }
        // Store strings directly
        else if (typeof valueToStore === "string") {
          storageValue = valueToStore;
        }
        // Handle null/undefined
        else if (valueToStore === null || valueToStore === undefined) {
          storageValue = JSON.stringify(null);
        }
        // Convert nested Files to serialized format and stringify
        else {
          const converted = await convertFilesToSerialized(valueToStore);
          storageValue = JSON.stringify(converted);
        }

        window.localStorage.setItem(key, storageValue);
      }
    } catch (error) {
      console.error("Error writing to localStorage:", error);
    }
  };

  return [storedValue, setValue as Dispatch<SetStateAction<Type>>];
}

export function useSessionStorage<Type>(
  key: string,
  initialValue: Type,
): [Type, Dispatch<SetStateAction<Type>>] {
  // Always start with initialValue to match SSR — avoids hydration mismatch
  const [storedValue, setStoredValue] = useState<Type>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Read from sessionStorage only after mount (client-side)
  useEffect(() => {
    try {
      const item = window.sessionStorage.getItem(key);
      if (item === null) {
        setHydrated(true);
        return;
      }

      // If initial value is a string, return the raw item
      if (typeof initialValue === "string") {
        setStoredValue(item as Type);
      }
      // If initial value is a File, handle it as a serialized file
      else if (initialValue instanceof File) {
        try {
          const parsed = JSON.parse(item);
          if (parsed && parsed.__isFile) {
            setStoredValue(
              base64ToFile(parsed.data, parsed.name, parsed.type) as Type,
            );
          }
        } catch {
          setStoredValue(
            base64ToFile(
              item,
              initialValue.name || "file",
              initialValue.type || "application/octet-stream",
            ) as Type,
          );
        }
      }
      // Parse JSON and convert serialized Files back to File objects
      else {
        const parsed = JSON.parse(item);
        setStoredValue(convertSerializedToFiles(parsed) as Type);
      }
    } catch (error) {
      console.error("Error reading from sessionStorage:", error);
    }
    setHydrated(true);
  }, []);

  const setValue = async (value: Type | ((prev: Type) => Type)) => {
    try {
      const valueToStore =
        typeof value === "function" ? (value as Function)(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        let storageValue: string;

        // Handle File objects
        if (valueToStore instanceof File) {
          const serialized = await convertFilesToSerialized(valueToStore);
          storageValue = JSON.stringify(serialized);
        }
        // Store strings directly
        else if (typeof valueToStore === "string") {
          storageValue = valueToStore;
        }
        // Handle null/undefined
        else if (valueToStore === null || valueToStore === undefined) {
          storageValue = JSON.stringify(null);
        }
        // Convert nested Files to serialized format and stringify
        else {
          const converted = await convertFilesToSerialized(valueToStore);
          storageValue = JSON.stringify(converted);
        }

        window.sessionStorage.setItem(key, storageValue);
      }
    } catch (error) {
      console.error("Error writing to sessionStorage:", error);
    }
  };

  return [storedValue, setValue as Dispatch<SetStateAction<Type>>];
}
