// Loaded from /lens.js. The live site allows script-src 'self' and blocks inline scripts.
(function () {
  var allowed = { new: 1, it: 1, sales: 1 };
  var storageKey = 'vaathi.lens';

  function isLens(value) {
    return !!value && Object.prototype.hasOwnProperty.call(allowed, value);
  }

  function readStored() {
    try {
      return localStorage.getItem(storageKey);
    } catch (e) {
      return null;
    }
  }

  function remember(lens) {
    try {
      localStorage.setItem(storageKey, lens);
    } catch (e) {}
  }

  function chosen() {
    var query = null;
    try {
      query = new URLSearchParams(location.search).get('lens');
    } catch (e) {}
    var stored = readStored();
    if (isLens(query)) return query;
    if (isLens(stored)) return stored;
    return 'new';
  }

  document.documentElement.setAttribute('data-lens', chosen());
  document.documentElement.setAttribute('data-lens-ready', 'ready');

  function propagateLinks(lens) {
    document.querySelectorAll('a[href^="/learn/foundations"], a[href^="/learn/build"]').forEach(function (anchor) {
      var url = new URL(anchor.getAttribute('href') || '', location.origin);
      url.searchParams.set('lens', lens);
      anchor.setAttribute('href', url.pathname + url.search);
    });
  }

  function syncExpand(skim) {
    var prose = document.querySelector('.lesson-prose');
    var open = !!(prose && prose.classList.contains('is-open'));
    var button = document.querySelector('[data-lens-expand]');
    if (!button) return;
    button.hidden = !skim;
    if (!skim) return;
    button.textContent = open ? 'Show the short version' : 'Read the full lesson';
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function apply(lens, updateUrl) {
    document.documentElement.setAttribute('data-lens', lens);
    document.documentElement.setAttribute('data-lens-ready', 'ready');
    remember(lens);

    document.querySelectorAll('[data-lens-choice]').forEach(function (input) {
      input.checked = input.value === lens;
    });

    var prose = document.querySelector('.lesson-prose');
    if (prose) prose.classList.remove('is-open');
    var card = document.querySelector('.lens-card[data-lens="' + lens + '"]');
    var skim = !!(card && card.getAttribute('data-relevance') === 'skim');
    if (prose) prose.classList.toggle('is-skim', skim);
    syncExpand(skim);
    propagateLinks(lens);

    if (updateUrl) {
      var url = new URL(location.href);
      url.searchParams.set('lens', lens);
      history.replaceState(null, '', url);
    }
  }

  function start() {
    var lens = document.documentElement.getAttribute('data-lens');
    apply(isLens(lens) ? lens : 'new', false);

    document.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || !target.matches || !target.matches('[data-lens-choice]')) return;
      if (!isLens(target.value)) return;
      apply(target.value, true);
    });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var button = target.closest('[data-lens-expand]');
      if (!button) return;
      var prose = document.querySelector('.lesson-prose');
      var open = prose ? prose.classList.toggle('is-open') : false;
      button.textContent = open ? 'Show the short version' : 'Read the full lesson';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
