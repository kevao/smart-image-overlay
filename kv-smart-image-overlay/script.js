(function () {


  const CONFIG = {
    SIZE: 32,
    THRESHOLD: 140,
    TOLERANCE: 15,
    TRANSPARENCY_THRESHOLD: 0.08,
    SMALL_IMAGE_THRESHOLD: 128
  };


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

  function scheduleWork() {
    if (scheduled) return;
    scheduled = true;

    const runner = (deadline) => {
      scheduled = false;

      let time = deadline?.timeRemaining?.() ?? 5;

      while (queue.size && time > 0) {
        const item = queue.values().next().value;
        queue.delete(item);

        processItem(item);

        time = deadline?.timeRemaining?.() ?? 0;
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

    canvas.width = CONFIG.SIZE;
    canvas.height = CONFIG.SIZE;

    try {
      ctx.drawImage(img, 0, 0, CONFIG.SIZE, CONFIG.SIZE);
      const data = ctx.getImageData(0, 0, CONFIG.SIZE, CONFIG.SIZE).data;

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

      const isSmall =
        img.naturalWidth <= CONFIG.SMALL_IMAGE_THRESHOLD ||
        img.naturalHeight <= CONFIG.SMALL_IMAGE_THRESHOLD;

      if (transparencyRatio < CONFIG.TRANSPARENCY_THRESHOLD && !isSmall) {
        return null;
      }

      if (!count) return 'rgba(0,0,0,0.5)';

      const avg = sum / count;

      if (Math.abs(avg - CONFIG.THRESHOLD) < CONFIG.TOLERANCE) {
        return 'rgba(0,0,0,0.5)';
      }

      return avg > CONFIG.THRESHOLD
        ? 'rgba(0,0,0,0.8)'
        : 'rgba(0,0,0,0.2)';
    } catch {
      return null;
    }
  }


  function cleanBackground(el) {
    if (!el) return;

    el.style.removeProperty('background');
    el.style.removeProperty('background-color');
    el.style.setProperty('background', 'none', 'important');
  }

  function cleanItem(item) {
    cleanBackground(item);
  }


  const MetaBoxHandler = {
    selector: '.rwmb-image-item',

    resolve(item) {
      return {
        container: item,
        img: item.querySelector('img')
      };
    },

    clean(item) {
      cleanBackground(item);
      cleanBackground(item.querySelector('.rwmb-file-icon'));
    }
  };

  const MediaLibraryHandler = {
    selector: 'li.attachment',

    resolve(item) {
      return {
        container: item.querySelector('.attachment-preview'),
        img: item.querySelector('img')
      };
    },

    clean(item) {
      cleanBackground(item.querySelector('.attachment-preview'));
    }
  };

  const HANDLERS = [MetaBoxHandler, MediaLibraryHandler];

  function getHandler(item) {
    return HANDLERS.find(h => item.matches(h.selector));
  }


  async function processItem(item) {
    if (item.dataset.overlayProcessed) return;

    const handler = getHandler(item);
    if (!handler) return;

    handler.clean(item);

    const { container, img } = handler.resolve(item);
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
    HANDLERS.forEach(h => {
      document.querySelectorAll(h.selector).forEach(enqueue);
    });
  }

  function observe() {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;

          HANDLERS.forEach(h => {
            if (node.matches?.(h.selector)) {
              enqueue(node);
            } else {
              node.querySelectorAll?.(h.selector).forEach(enqueue);
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