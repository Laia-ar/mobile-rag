import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  KnowledgeDocument,
  SavedGuide,
  SavedSource,
  SourceReference,
} from '../types/knowledge';

const STORAGE_KEY = '@infecto-assist/saved-items-v1';

type StoredItems = {
  sources: SavedSource[];
  guides: SavedGuide[];
};

const EMPTY_ITEMS: StoredItems = {sources: [], guides: []};

function parseStoredItems(value: string | null): StoredItems {
  if (!value) return EMPTY_ITEMS;
  try {
    const parsed = JSON.parse(value) as Partial<StoredItems>;
    return {
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      guides: Array.isArray(parsed.guides) ? parsed.guides : [],
    };
  } catch {
    return EMPTY_ITEMS;
  }
}

export function useSavedItems() {
  const [items, setItems] = useState<StoredItems>(EMPTY_ITEMS);
  const itemsRef = useRef<StoredItems>(EMPTY_ITEMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(value => {
        const storedItems = parseStoredItems(value);
        itemsRef.current = storedItems;
        setItems(storedItems);
      })
      .catch(cause =>
        setError(cause instanceof Error ? cause : new Error(String(cause))),
      )
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((next: StoredItems) => {
    itemsRef.current = next;
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(cause =>
      setError(cause instanceof Error ? cause : new Error(String(cause))),
    );
  }, []);

  const saveSource = useCallback(
    (source: SourceReference) => {
      const current = itemsRef.current;
      if (current.sources.some(item => item.chunkId === source.chunkId)) return;
      persist({
        ...current,
        sources: [...current.sources, {...source, savedAt: new Date().toISOString()}],
      });
    },
    [persist],
  );

  const removeSource = useCallback(
    (chunkId: string) => {
      const current = itemsRef.current;
      persist({
        ...current,
        sources: current.sources.filter(item => item.chunkId !== chunkId),
      });
    },
    [persist],
  );

  const toggleGuide = useCallback(
    (guide: KnowledgeDocument) => {
      const current = itemsRef.current;
      const exists = current.guides.some(item => item.id === guide.id);
      persist({
        ...current,
        guides: exists
          ? current.guides.filter(item => item.id !== guide.id)
          : [...current.guides, {...guide, savedAt: new Date().toISOString()}],
      });
    },
    [persist],
  );

  return {
    loading,
    error,
    savedSources: items.sources,
    savedGuides: items.guides,
    savedSourceIds: useMemo(
      () => items.sources.map(item => item.chunkId),
      [items.sources],
    ),
    savedGuideIds: useMemo(
      () => items.guides.map(item => item.id),
      [items.guides],
    ),
    saveSource,
    removeSource,
    toggleGuide,
  };
}
