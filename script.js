(function () {
  const SELECTORS = [
    '.rwmb-image-item',
    'li.attachment'
  ];

  const SIZE = 32;
  const THRESHOLD = 140;
  const TOLERANCE = 15;
  const TRANSPARENCY_THRESHOLD = 0.08;

  const queue = new Set();
  const svgCache = new Map();

  let scheduled = false;

  function injectCSS() {
    if (document.getElementById('smart-overlay-global')) return;

    const style = document.createElement('style');
    style.id = 'smart-overlay-global';
    style.innerHTML = `
      .smart-overlay-container {
        position: relative;
        z-index: 0;
        background: none !important;
      }

      .smart-overlay-container.smart-overlay::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        background: var(--smart-overlay-bg);
        z-index: -1;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanBackground(el) {
    if (!el) return;

    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.setProperty('background', 'none', 'important');
  }

  function cleanItem(item) {
    cleanBackground(item);

    const mb = item.querySelector('.rwmb-file-icon');
    if (mb) cleanBackground(mb);

    const wp = item.querySelector('.attachment-preview');
    if (wp) cleanBackground(wp);
  }

  function scheduleWork() {
    if (scheduled) return;
    scheduled = true;

    const runner = (deadline) => {
      scheduled = false;

      let timeRemaining = deadline?.timeRemaining?.() ?? 5;

      while (queue.size && timeRemaining > 0) {
        const item = queue.values().next().value;
        queue.delete(item);

        processItem(item);

        timeRemaining = deadline?.timeRemaining?.() ?? 0;
      }

      if (queue.size) scheduleWork();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(runner);
    } else {
      requestAnimationFrame(() => runner());
    }
  }

  function enqueue(item) {
    if (item.dataset.overlayProcessed) return;

    cleanItem(item);
    queue.add(item);
    scheduleWork();
  }

  async function isSvgUsingCurrentColor(src) {
    if (svgCache.has(src)) return svgCache.get(src);

    try {
      const res = await fetch(src);
      const text = await res.text();

      const uses = text.includes('currentColor');

      svgCache.set(src, uses);
      return uses;
    } catch {
      svgCache.set(src, false);
      return false;
    }
  }

  function analyzeImage(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = SIZE;
    canvas.height = SIZE;

    try {
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

      let sum = 0;
      let count = 0;
      let transparentCount = 0;

      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 250) transparentCount++;
        if (a < 10) continue;

        sum += (0.299 * r + 0.587 * g + 0.114 * b);
        count++;
      }

      const transparencyRatio = transparentCount / (totalPixels / 4);

      if (transparencyRatio < TRANSPARENCY_THRESHOLD) {
        return null;
      }

      if (!count) return 'rgba(0,0,0,0.5)';

      const avg = sum / count;

      if (Math.abs(avg - THRESHOLD) < TOLERANCE) {
        return 'rgba(0,0,0,0.5)';
      }

      return avg > THRESHOLD
        ? 'rgba(0,0,0,0.8)'
        : 'rgba(0,0,0,0.2)';
    } catch {
      return null;
    }
  }

  function resolveContainer(item) {
    if (item.matches('.rwmb-image-item')) {
      return {
        container: item,
        img: item.querySelector('img')
      };
    }

    if (item.matches('li.attachment')) {
      return {
        container: item.querySelector('.attachment-preview'),
        img: item.querySelector('img')
      };
    }

    return {};
  }

  async function processItem(item) {
    if (item.dataset.overlayProcessed) return;

    const { container, img } = resolveContainer(item);
    if (!container || !img) return;

    const apply = async () => {
      let overlay;

      if (img.src.endsWith('.svg')) {
        const usesCurrentColor = await isSvgUsingCurrentColor(img.src);

        overlay = usesCurrentColor
          ? 'rgba(0,0,0,0.2)'
          : analyzeImage(img);
      } else {
        overlay = analyzeImage(img);
      }

      if (!overlay) {
        item.dataset.overlayProcessed = 'true';
        return;
      }

      container.style.setProperty('--smart-overlay-bg', overlay);
      container.classList.add('smart-overlay-container', 'smart-overlay');

      item.dataset.overlayProcessed = 'true';
    };

    if (img.complete) {
      apply();
    } else {
      img.addEventListener('load', apply, { once: true });
    }
  }

  function scan() {
    SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(enqueue);
    });
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          SELECTORS.forEach(sel => {
            if (node.matches?.(sel)) {
              enqueue(node);
            } else {
              node.querySelectorAll?.(sel).forEach(enqueue);
            }
          });
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  injectCSS();
  scan();
  observe();
})();