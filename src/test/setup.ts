import '@testing-library/jest-dom/vitest';

// Mantine использует matchMedia и ResizeObserver, которых нет в jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    // как в браузере: пустой запрос совпадает всегда - mantine-datatable так проверяет видимость колонок
    matches: query.trim() === '',
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.ResizeObserver = ResizeObserverStub;
