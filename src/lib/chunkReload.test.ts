import { CHUNK_RELOAD_KEY, isChunkLoadError, reloadForNewVersion } from './chunkReload';

const reload = vi.fn();

beforeEach(() => {
  window.sessionStorage.clear();
  reload.mockReset();
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => vi.unstubAllGlobals());

describe('isChunkLoadError', () => {
  it('узнаёт ошибку загрузки чанка в Chrome, Firefox и Safari', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: http://x/assets/PlanPage-a.js'))).toBe(
      true,
    );
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: http://x/assets/a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
  });

  it('другие ошибки - не чанк', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reloadForNewVersion', () => {
  it('перезагружает и запоминает время', () => {
    expect(reloadForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull();
  });

  it('сразу после перезагрузки второй раз не перезагружает', () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));

    expect(reloadForNewVersion()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('прошлая перезагрузка была давно - перезагружает снова', () => {
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 60_000));

    expect(reloadForNewVersion()).toBe(true);
  });
});
