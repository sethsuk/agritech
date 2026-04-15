"use client";

import { useEffect, useState } from "react";

const KEY_WORKER = "currentWorkerId";
const KEY_RECENT = "recentTrees";
const RECENT_LIMIT = 3;

export type StoredWorker = { id: string; name: string };

export function setCurrentWorker(worker: StoredWorker) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_WORKER, JSON.stringify(worker));
}

export function getCurrentWorker(): StoredWorker | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY_WORKER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredWorker;
  } catch {
    return null;
  }
}

export function clearCurrentWorker() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_WORKER);
}

export function useCurrentWorker() {
  const [worker, setWorker] = useState<StoredWorker | null>(null);
  useEffect(() => {
    setWorker(getCurrentWorker());
  }, []);
  return worker;
}

export function pushRecentTree(treeId: string) {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(KEY_RECENT);
  let list: string[] = [];
  try {
    list = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    list = [];
  }
  list = [treeId, ...list.filter((t) => t !== treeId)].slice(0, RECENT_LIMIT);
  localStorage.setItem(KEY_RECENT, JSON.stringify(list));
}

export function getRecentTrees(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY_RECENT);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}
