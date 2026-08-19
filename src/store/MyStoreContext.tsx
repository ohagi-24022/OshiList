import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type MyStore = {
  id: string;
  name: string;
  url: string;
  domain: string;
  priority: boolean;
};

type MyStoreContextValue = {
  stores: MyStore[];
  selectedStoreId: string | null;
  selectedStore: MyStore | null;
  addStore: (input: { name: string; url: string; priority?: boolean }) => Promise<void>;
  updateStore: (id: string, patch: Partial<Pick<MyStore, 'name' | 'url' | 'priority'>>) => Promise<void>;
  removeStore: (id: string) => Promise<void>;
  selectStore: (id: string | null) => Promise<void>;
};

const STORAGE_KEY = 'oshilist.myStores.v1';
const SELECTED_KEY = 'oshilist.myStores.selected.v1';

const MyStoreContext = createContext<MyStoreContextValue | null>(null);

function storeId() {
  return `store-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStoreDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .replace(/^www\./, '')
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '');
  }
}

function normalizeStore(input: Partial<MyStore>, fallbackId = storeId()): MyStore | null {
  const domain = normalizeStoreDomain(input.url || input.domain || '');
  const name = (input.name || domain).trim();
  if (!domain || !name) return null;
  return {
    id: input.id || fallbackId,
    name,
    url: (input.url || `https://${domain}`).trim(),
    domain,
    priority: Boolean(input.priority),
  };
}

function readStores(stored: string): MyStore[] {
  try {
    const parsed = JSON.parse(stored) as Partial<MyStore>[];
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .map((item, index) => normalizeStore(item, item.id || `store-${index}`))
      .filter((item): item is MyStore => {
        if (!item || seen.has(item.domain)) return false;
        seen.add(item.domain);
        return true;
      });
  } catch {
    return [];
  }
}

export function MyStoreProvider({ children }: PropsWithChildren) {
  const [stores, setStores] = useState<MyStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(SELECTED_KEY)]).then(([storedStores, storedSelected]) => {
      const nextStores = storedStores ? readStores(storedStores) : [];
      setStores(nextStores);
      setSelectedStoreId(storedSelected && nextStores.some((store) => store.id === storedSelected) ? storedSelected : null);
    });
  }, []);

  const persistStores = async (nextStores: MyStore[]) => {
    setStores(nextStores);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextStores));
  };

  const addStore = async (input: { name: string; url: string; priority?: boolean }) => {
    const nextStore = normalizeStore({ ...input, id: storeId() });
    if (!nextStore) return;
    const nextStores = [nextStore, ...stores.filter((store) => store.domain !== nextStore.domain)];
    await persistStores(nextStores);
    if (!selectedStoreId || nextStore.priority) {
      setSelectedStoreId(nextStore.id);
      await AsyncStorage.setItem(SELECTED_KEY, nextStore.id);
    }
  };

  const updateStore = async (id: string, patch: Partial<Pick<MyStore, 'name' | 'url' | 'priority'>>) => {
    const current = stores.find((store) => store.id === id);
    if (!current) return;
    const normalized = normalizeStore({ ...current, ...patch }, id);
    if (!normalized) return;
    const nextStores = stores.map((store) => (store.id === id ? normalized : store)).filter((store, index, items) => items.findIndex((item) => item.domain === store.domain) === index);
    await persistStores(nextStores);
  };

  const removeStore = async (id: string) => {
    const nextStores = stores.filter((store) => store.id !== id);
    await persistStores(nextStores);
    if (selectedStoreId === id) {
      await selectStore(null);
    }
  };

  const selectStore = async (id: string | null) => {
    const nextId = id && stores.some((store) => store.id === id) ? id : null;
    setSelectedStoreId(nextId);
    if (nextId) {
      await AsyncStorage.setItem(SELECTED_KEY, nextId);
    } else {
      await AsyncStorage.removeItem(SELECTED_KEY);
    }
  };

  const selectedStore = stores.find((store) => store.id === selectedStoreId) ?? null;
  const value = useMemo(
    () => ({ stores, selectedStoreId, selectedStore, addStore, updateStore, removeStore, selectStore }),
    [stores, selectedStoreId, selectedStore],
  );

  return <MyStoreContext.Provider value={value}>{children}</MyStoreContext.Provider>;
}

export function useMyStores() {
  const context = useContext(MyStoreContext);
  if (!context) {
    throw new Error('useMyStores must be used inside MyStoreProvider');
  }
  return context;
}
