import { isLensId, LENS_STORAGE_KEY, type LensId } from '../lib/lenses';

function currentLens(): LensId {
  const value = document.documentElement.dataset.lens;
  return isLensId(value) ? value : 'new';
}

function remember(lens: LensId) {
  try {
    localStorage.setItem(LENS_STORAGE_KEY, lens);
  } catch {
    /* private mode and blocked storage still work for this page */
  }
}

function propagateLinks(lens: LensId) {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="/learn/foundations"]').forEach((anchor) => {
    const url = new URL(anchor.getAttribute('href') || '', location.origin);
    url.searchParams.set('lens', lens);
    anchor.setAttribute('href', `${url.pathname}${url.search}`);
  });
}

function syncExpand(skim: boolean) {
  const prose = document.querySelector('.lesson-prose');
  const open = prose?.classList.contains('is-open') ?? false;
  const button = document.querySelector<HTMLButtonElement>('[data-lens-expand]');
  if (!button) return;
  button.hidden = !skim;
  if (!skim) return;
  button.textContent = open ? 'Show the short version' : 'Read the full lesson';
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function apply(lens: LensId, updateUrl: boolean) {
  document.documentElement.dataset.lens = lens;
  document.documentElement.dataset.lensReady = 'ready';
  remember(lens);

  document.querySelectorAll<HTMLInputElement>('[data-lens-choice]').forEach((input) => {
    input.checked = input.value === lens;
  });

  const prose = document.querySelector('.lesson-prose');
  prose?.classList.remove('is-open');
  const card = document.querySelector(`.lens-card[data-lens="${CSS.escape(lens)}"]`);
  const skim = card?.getAttribute('data-relevance') === 'skim';
  prose?.classList.toggle('is-skim', skim);
  syncExpand(skim);
  propagateLinks(lens);

  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('lens', lens);
    history.replaceState(null, '', url);
  }
}

apply(currentLens(), false);

document.addEventListener('change', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || !target.matches('[data-lens-choice]')) return;
  if (!isLensId(target.value)) return;
  apply(target.value, true);
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLButtonElement>('[data-lens-expand]');
  if (!button) return;
  const prose = document.querySelector('.lesson-prose');
  const open = prose?.classList.toggle('is-open') ?? false;
  button.textContent = open ? 'Show the short version' : 'Read the full lesson';
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
});
