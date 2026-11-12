/** Когда последний раз перезагружали страницу из-за пропавшего чанка (sessionStorage) */
export const CHUNK_RELOAD_KEY = 'invest:chunk-reload-at';
/** Не чаще: если чанка нет и после перезагрузки, второй раз не перезагружаем - показываем ошибку */
const RELOAD_INTERVAL_MS = 10_000;

/**
 * Не загрузился чанк страницы. Имена чанков содержат хеш: вкладка, открытая до выкладки новой версии, держит старый
 * index.js и просит чанк, которого на сервере уже нет. Текст ошибки у браузеров разный.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    message,
  );
}

/**
 * Перезагрузить страницу, чтобы взять новый index.html (он отдаётся с no-cache), - если не перезагружали только что.
 *
 * @return true - перезагрузка началась
 */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last <= RELOAD_INTERVAL_MS) {
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage недоступен - не рискуем бесконечной перезагрузкой
    return false;
  }
  window.location.reload();
  return true;
}
