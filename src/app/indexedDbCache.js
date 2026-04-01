const DB_NAME = "educhat-ui-cache";
const DB_VERSION = 1;
const PAGE_SNAPSHOT_STORE = "page_snapshots";

function isIndexedDbAvailable() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openCacheDb() {
  if (!isIndexedDbAvailable()) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PAGE_SNAPSHOT_STORE)) {
        db.createObjectStore(PAGE_SNAPSHOT_STORE, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("IndexedDB 打开失败。"));
    };
  });
}

function runStoreRequest(mode, executor) {
  return openCacheDb().then((db) => {
    if (!db) return null;

    return new Promise((resolve, reject) => {
      let settled = false;
      let result = null;
      const closeAndResolve = (callback, value) => {
        if (settled) return;
        settled = true;
        db.close();
        callback(value);
      };

      try {
        const transaction = db.transaction(PAGE_SNAPSHOT_STORE, mode);
        const store = transaction.objectStore(PAGE_SNAPSHOT_STORE);
        const request = executor(store);

        request.onsuccess = () => {
          result = request.result ?? null;
        };

        request.onerror = () => {
          closeAndResolve(reject, request.error || new Error("IndexedDB 读写失败。"));
        };

        transaction.onabort = () => {
          closeAndResolve(reject, transaction.error || new Error("IndexedDB 事务被中止。"));
        };

        transaction.onerror = () => {
          closeAndResolve(reject, transaction.error || new Error("IndexedDB 事务失败。"));
        };

        transaction.oncomplete = () => {
          closeAndResolve(resolve, result);
        };
      } catch (error) {
        closeAndResolve(reject, error);
      }
    });
  });
}

export async function getPageSnapshot(key) {
  const safeKey = String(key || "").trim();
  if (!safeKey) return null;
  try {
    return await runStoreRequest("readonly", (store) => store.get(safeKey));
  } catch {
    return null;
  }
}

export async function setPageSnapshot(key, data, ttlMs, version = 1) {
  const safeKey = String(key || "").trim();
  if (!safeKey) return null;
  const expiresAt = Number(ttlMs) > 0 ? Date.now() + Number(ttlMs) : 0;
  const record = {
    key: safeKey,
    version: Number(version) > 0 ? Number(version) : 1,
    updatedAt: new Date().toISOString(),
    expiresAt,
    data: data && typeof data === "object" ? data : {},
  };

  try {
    return await runStoreRequest("readwrite", (store) => store.put(record));
  } catch {
    return null;
  }
}

export async function deletePageSnapshot(key) {
  const safeKey = String(key || "").trim();
  if (!safeKey) return null;
  try {
    return await runStoreRequest("readwrite", (store) => store.delete(safeKey));
  } catch {
    return null;
  }
}

export function isSnapshotUsable(record, expectedVersion = 1) {
  if (!record || typeof record !== "object") return false;
  if (Number(record.version || 0) !== Number(expectedVersion || 1)) return false;
  const expiresAt = Number(record.expiresAt || 0);
  if (expiresAt > 0 && expiresAt < Date.now()) return false;
  return record.data && typeof record.data === "object";
}
