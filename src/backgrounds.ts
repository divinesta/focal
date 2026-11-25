// Break-screen backgrounds.
// A background value is "none" (plain theme colour), "builtin:<name>", or "custom:<id>".
// Custom images live in IndexedDB, which both windows (main + overlay) share.

export const BUILTIN: { id: string; name: string }[] = [
  { id: "misty-river", name: "Misty river" },
  { id: "fjord", name: "Fjord" },
  { id: "lake", name: "Lake" },
  { id: "valley", name: "Valley" },
  { id: "waterfall", name: "Waterfall" },
  { id: "highlands", name: "Highlands" },
  { id: "coast", name: "Coast" },
  { id: "forest-sea", name: "Forest & sea" },
  { id: "clouds", name: "Clouds" },
  { id: "storm-sea", name: "Storm sea" },
  { id: "canyon", name: "Canyon" },
  { id: "city-dusk", name: "City at dusk" },
];

export const builtinThumb = (id: string) => `/backgrounds/thumbs/${id}.jpg`;

export type CustomBg = { id: string; name: string; blob: Blob; thumb: Blob };

const DB = "focal";
const STORE = "backgrounds";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/** Small 240x135 cover-cropped preview so the settings grid stays light. */
async function makeThumb(file: Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  const W = 240, H = 135;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale, h = img.height * scale;
  c.getContext("2d")!.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  return new Promise((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.8));
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function addCustomBackground(file: File): Promise<string> {
  const id = newId();
  const thumb = await makeThumb(file);
  await run("readwrite", (s) => s.put({ id, name: file.name, blob: file, thumb }));
  return id;
}

export const listCustomBackgrounds = () => run<CustomBg[]>("readonly", (s) => s.getAll());
export const deleteCustomBackground = (id: string) => run<void>("readwrite", (s) => s.delete(id));

/** Resolve a background value to an image URL, or null for the plain colour. */
export async function backgroundUrl(value: string): Promise<string | null> {
  if (value.startsWith("builtin:")) return `/backgrounds/${value.slice(8)}.jpg`;
  if (value.startsWith("custom:")) {
    try {
      const r = await run<CustomBg | undefined>("readonly", (s) => s.get(value.slice(7)));
      return r ? URL.createObjectURL(r.blob) : null;
    } catch {
      return null;
    }
  }
  return null;
}
