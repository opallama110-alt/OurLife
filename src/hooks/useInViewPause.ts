import { RefObject, useEffect } from 'react';

// One IntersectionObserver shared by every decorative loop (streak flames,
// hearts, …). It toggles a `data-paused` DOM attribute — not React state, so
// scrolling never re-renders anything — and CSS pauses the element's
// infinite animations while it's off screen (battery + main-thread savings
// with a long habit list).
let observer: IntersectionObserver | null = null;

const getObserver = (): IntersectionObserver | null => {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (!observer) {
    observer = new IntersectionObserver(
      entries => {
        for (const e of entries) (e.target as HTMLElement).toggleAttribute('data-paused', !e.isIntersecting);
      },
      { rootMargin: '64px' },
    );
  }
  return observer;
};

export function useInViewPause(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    const io = getObserver();
    if (!el || !io) return;
    io.observe(el);
    return () => io.unobserve(el);
  }, [ref]);
}
