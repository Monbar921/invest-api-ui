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

// и scrollIntoView: Combobox Mantine прокручивает к выбранному пункту по таймеру, уже после конца теста
Element.prototype.scrollIntoView = () => {};

// аналитика держит состояние в модуле и в window - после каждого теста как в сборке без счётчика
afterEach(async () => {
  const { resetAnalytics } = await import('../lib/analytics');
  vi.unstubAllEnvs();
  resetAnalytics();
  delete window.ym;
  window.localStorage.clear();
  document.head.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((script) => script.remove());
});
