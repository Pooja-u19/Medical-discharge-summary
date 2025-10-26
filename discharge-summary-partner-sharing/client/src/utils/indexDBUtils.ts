export async function openDatabase(
  dbName: string,
  version: number,
  upgradeCallback?: (db: IDBDatabase) => void
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (upgradeCallback) {
        upgradeCallback(db);
      }
    };
  });
}

export async function createObjectStore<T>(
  db: IDBDatabase,
  storeName: string,
  keyPath: keyof T & string,
  indexes: {
    name: string;
    keyPath: keyof T & string;
    options?: IDBIndexParameters;
  }[] = []
) {
  if (!db.objectStoreNames.contains(storeName)) {
    const store = db.createObjectStore(storeName, { keyPath });
    indexes.forEach(({ name, keyPath, options }) => {
      store.createIndex(name, keyPath, options || {});
    });
  } else {
    console.warn(`Store ${storeName} already exists, skipping creation.`);
  }
}

export async function addData<T>(
  db: IDBDatabase,
  storeName: string,
  data: T
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .add(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getData<T>(
  db: IDBDatabase,
  storeName: string,
  key: string,
  limit?: number,
  offset?: number
): Promise<{ count: number; data: T[] } | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);

    let request: IDBRequest;
    if (limit && offset !== undefined) {
      const range = IDBKeyRange.lowerBound(offset);
      request = store.index(key).openCursor(range, "next");
    } else if (limit) {
      request = store.openCursor(null, "next");
    } else {
      request = store.get(key);
    }

    let data: T[] = [];
    let count = 0;

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        count++;
        if (limit && data.length < limit) {
          data.push(cursor.value);
        }
        cursor.continue();
      }

      if (!cursor || (limit && data.length >= limit)) {
        resolve({ count, data });
      }
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getAllData<T>(
  db: IDBDatabase,
  storeName: string
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readonly")
      .objectStore(storeName)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateData<T>(
  db: IDBDatabase,
  storeName: string,
  data: T
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteData(
  db: IDBDatabase,
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
