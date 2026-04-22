import { useEffect, useState, useRef } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

/**
 * Shared subscription cache.
 *
 * Why: previously every page mounted its own onValue() listener for the same
 * path (e.g. "movies"). On every route change the listener was torn down and
 * recreated, which (a) showed a `loading` flash, (b) re-downloaded data,
 * (c) re-ran heavy filter/sort work. Navigation felt sluggish.
 *
 * Now: we keep one Firebase listener per path alive as long as ANY component
 * is reading it (refcount), and we cache the latest snapshot synchronously.
 * Remounts get data on the very first render → navigation is instant.
 */

type Entry = {
  value: any;
  hasValue: boolean;
  refCount: number;
  unsub: null | (() => void);
  listeners: Set<(v: any) => void>;
};

const cache = new Map<string, Entry>();

function getEntry(path: string): Entry {
  let e = cache.get(path);
  if (!e) {
    e = { value: undefined, hasValue: false, refCount: 0, unsub: null, listeners: new Set() };
    cache.set(path, e);
  }
  return e;
}

function subscribe(path: string, cb: (v: any) => void): () => void {
  const e = getEntry(path);
  e.listeners.add(cb);
  e.refCount += 1;

  if (!e.unsub) {
    const r = ref(db, path);
    e.unsub = onValue(
      r,
      (snap) => {
        e!.value = snap.val();
        e!.hasValue = true;
        e!.listeners.forEach((fn) => fn(e!.value));
      },
      () => {
        e!.hasValue = true;
        e!.listeners.forEach((fn) => fn(e!.value));
      }
    );
  }

  return () => {
    e.listeners.delete(cb);
    e.refCount -= 1;
    if (e.refCount <= 0) {
      // Keep the subscription alive briefly so quick back/forward navigations
      // don't tear it down and re-create it.
      const toClose = e;
      setTimeout(() => {
        if (toClose.refCount <= 0 && toClose.unsub) {
          toClose.unsub();
          toClose.unsub = null;
        }
      }, 30_000);
    }
  };
}

function toList<T>(val: any): (T & { id: string })[] {
  if (!val) return [];
  return Object.entries(val).map(([id, v]) => ({ id, ...(v as any) }));
}

export function useFirebaseList<T = any>(path: string): { data: (T & { id: string })[]; loading: boolean } {
  const e = getEntry(path);
  const initialData = e.hasValue ? toList<T>(e.value) : [];
  const [data, setData] = useState<(T & { id: string })[]>(initialData);
  const [loading, setLoading] = useState(!e.hasValue);
  const lastRaw = useRef<any>(e.hasValue ? e.value : undefined);

  useEffect(() => {
    const cb = (v: any) => {
      // Avoid useless re-renders if the underlying ref is the same object.
      if (lastRaw.current === v) return;
      lastRaw.current = v;
      setData(toList<T>(v));
      setLoading(false);
    };
    const e2 = getEntry(path);
    if (e2.hasValue) {
      cb(e2.value);
    }
    const unsub = subscribe(path, cb);
    return unsub;
  }, [path]);

  return { data, loading };
}

export function useFirebaseValue<T = any>(path: string | null): { data: T | null; loading: boolean } {
  const e = path ? getEntry(path) : null;
  const initialValue = e && e.hasValue ? (e.value as T | null) : null;
  const [data, setData] = useState<T | null>(initialValue);
  const [loading, setLoading] = useState(!(e && e.hasValue));

  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const e2 = getEntry(path);
    if (e2.hasValue) {
      setData((e2.value as T | null) ?? null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const cb = (v: any) => {
      setData((v as T | null) ?? null);
      setLoading(false);
    };
    const unsub = subscribe(path, cb);
    return unsub;
  }, [path]);

  return { data, loading };
}
