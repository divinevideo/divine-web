import { useCallback, useEffect, useRef, useState } from 'react';

const LOCAL_STORAGE_CHANGE_EVENT = 'local-storage-change';

interface LocalStorageChangeDetail {
  key: string;
  newValue: string | null;
}

/**
 * Generic hook for managing localStorage state
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
) {
  const serialize = serializer?.serialize || JSON.stringify;
  const deserialize = serializer?.deserialize || JSON.parse;

  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  });
  const stateRef = useRef(state);

  stateRef.current = state;

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(stateRef.current) : value;
      const serializedValue = serialize(valueToStore);
      setState(valueToStore);
      localStorage.setItem(key, serializedValue);
      window.dispatchEvent(new CustomEvent<LocalStorageChangeDetail>(LOCAL_STORAGE_CHANGE_EVENT, {
        detail: {
          key,
          newValue: serializedValue,
        },
      }));
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  }, [key, serialize]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const syncFromSerializedValue = (serializedValue: string | null) => {
      if (serializedValue === null) {
        setState(defaultValue);
        return;
      }

      try {
        setState(deserialize(serializedValue));
      } catch (error) {
        console.warn(`Failed to sync ${key} from localStorage:`, error);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        syncFromSerializedValue(e.newValue);
      }
    };

    const handleSameTabChange = (event: Event) => {
      const customEvent = event as CustomEvent<LocalStorageChangeDetail>;
      if (customEvent.detail?.key === key) {
        syncFromSerializedValue(customEvent.detail.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleSameTabChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(LOCAL_STORAGE_CHANGE_EVENT, handleSameTabChange as EventListener);
    };
  }, [defaultValue, deserialize, key]);

  return [state, setValue] as const;
}
