import { useEffect } from 'react';

/** Название сайта в title - то же, что у gateway (invest.gateway.seo.site-name) */
export const SITE_NAME = 'Облигации';

export interface PageMeta {
  /** Заголовок без названия сайта: «ОФЗ 26238 (SU26238RMFS4)» */
  title: string;
  description?: string;
  /** Путь без query для canonical: «/bonds/SU26238RMFS4»; не задан - canonical убирается */
  canonicalPath?: string;
  /** Страница не для поисковиков: личные разделы, 404 */
  noindex?: boolean;
  /** og:type: article - облигация, website - остальное */
  ogType?: 'website' | 'article';
}

/** Полный title: «<title> - Облигации» */
export function fullTitle(title: string): string {
  return title === SITE_NAME ? title : `${title} - ${SITE_NAME}`;
}

/**
 * Метаданные страницы в <head>. Первый показ страницы по ссылке приходит от gateway уже с ними (SEO-страницы),
 * а при переходах внутри SPA их обновляет этот хук: те же теги, без дублей - существующий тег меняется.
 */
export function usePageMeta(meta: PageMeta | null) {
  const title = meta?.title;
  const description = meta?.description;
  const canonicalPath = meta?.canonicalPath;
  const noindex = meta?.noindex ?? false;
  const ogType = meta?.ogType ?? 'website';

  useEffect(() => {
    // пока данные грузятся, оставляем то, что есть (у SEO-страницы - метаданные от gateway)
    if (title === undefined) {
      return;
    }
    applyPageMeta({ title, description, canonicalPath, noindex, ogType });
  }, [title, description, canonicalPath, noindex, ogType]);
}

export function applyPageMeta({ title, description, canonicalPath, noindex = false, ogType = 'website' }: PageMeta) {
  const head = document.head;
  const full = fullTitle(title);
  document.title = full;

  setMeta(head, 'name', 'description', description);
  setMeta(head, 'name', 'robots', noindex ? 'noindex' : undefined);
  setMeta(head, 'property', 'og:title', full);
  setMeta(head, 'property', 'og:description', description);
  setMeta(head, 'property', 'og:type', ogType);

  const url = canonicalPath && !noindex ? new URL(canonicalPath, window.location.origin).toString() : undefined;
  setMeta(head, 'property', 'og:url', url);
  let canonical = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    canonical?.remove();
    return;
  }
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    head.appendChild(canonical);
  }
  canonical.href = url;
}

/** content не задан - тега нет: прежнее значение другой страницы не должно остаться */
function setMeta(head: HTMLHeadElement, attribute: 'name' | 'property', key: string, content: string | undefined) {
  let element = head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (content === undefined || content === '') {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    head.appendChild(element);
  }
  element.content = content;
}
