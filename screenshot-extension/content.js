(function () {
  if (window.__fpssLoaded) return;
  window.__fpssLoaded = true;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  async function captureVisibleTab() {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!res || !res.ok) return reject(new Error((res && res.error) || 'capture failed'));
            resolve(res.dataUrl);
          });
        });
      } catch (err) {
        if (attempt === 2) throw err;
        await sleep(500); // Chrome rate-limits captureVisibleTab; back off and retry
      }
    }
  }

  function showToast(text) {
    let el = document.getElementById('__fpss_toast');
    if (!el) {
      el = document.createElement('div');
      el.id = '__fpss_toast';
      Object.assign(el.style, {
        position: 'fixed',
        top: '12px',
        right: '12px',
        zIndex: 2147483647,
        background: 'rgba(0,0,0,0.85)',
        color: '#fff',
        padding: '8px 14px',
        borderRadius: '6px',
        font: '13px sans-serif',
        pointerEvents: 'none',
      });
      document.documentElement.appendChild(el);
    }
    el.textContent = text;
    el.style.display = 'block';
  }

  function hideToast() {
    const el = document.getElementById('__fpss_toast');
    if (el) el.style.display = 'none';
  }

  function downloadCanvas(canvas, filename) {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function findScrollableAncestor(el) {
    let node = el;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const overflowY = style.overflowY;
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2;
      if (canScroll) return node;
      node = node.parentElement;
    }
    return null;
  }

  // Picks the best scroll target automatically: the page itself if it scrolls
  // meaningfully, otherwise the largest inner element that has its own scrollbar.
  function detectScrollTarget() {
    const MIN_SCROLLABLE = 40; // px of hidden content before we bother scrolling
    const MIN_SIZE = 80; // ignore tiny scroll areas (menus, tooltips, etc.)

    const pageHidden = document.documentElement.scrollHeight - window.innerHeight;

    let bestEl = null;
    let bestHidden = pageHidden > MIN_SCROLLABLE ? pageHidden : -1;

    const candidates = document.querySelectorAll('*');
    for (const el of candidates) {
      const hidden = el.scrollHeight - el.clientHeight;
      if (hidden <= MIN_SCROLLABLE) continue;
      const style = getComputedStyle(el);
      if (style.overflowY !== 'auto' && style.overflowY !== 'scroll') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) continue;
      if (hidden > bestHidden) {
        bestHidden = hidden;
        bestEl = el;
      }
    }

    if (bestEl) return { scroller: bestEl, regionEl: bestEl, isPage: false };
    return { scroller: document.scrollingElement, regionEl: document.documentElement, isPage: true };
  }

  function smoothScrollTo(scroller, isPage, top) {
    return new Promise((resolve) => {
      let done = false;
      const target = isPage ? window : scroller;
      const finish = () => {
        if (done) return;
        done = true;
        target.removeEventListener('scrollend', finish);
        clearTimeout(timer);
        resolve();
      };
      target.addEventListener('scrollend', finish, { once: true });
      const timer = setTimeout(finish, 900); // fallback if scrollend isn't supported or distance is ~0
      if (isPage) {
        window.scrollTo({ top, left: 0, behavior: 'smooth' });
      } else {
        scroller.scrollTo({ top, left: scroller.scrollLeft, behavior: 'smooth' });
      }
    });
  }

  async function captureScrollable(scroller, regionEl, isPage) {
    const dpr = window.devicePixelRatio || 1;
    const originalScrollTop = isPage ? window.scrollY : scroller.scrollTop;
    const originalScrollLeft = isPage ? window.scrollX : scroller.scrollLeft;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let cropX, cropWidthCss, cropYTop, visibleHeightCss;

    if (isPage) {
      cropX = 0;
      cropWidthCss = viewportW;
      cropYTop = 0;
      visibleHeightCss = viewportH;
    } else {
      regionEl.scrollIntoView({ block: 'center', inline: 'nearest' });
      await waitForPaint();
      const rect = regionEl.getBoundingClientRect();
      cropX = Math.max(rect.left, 0);
      cropWidthCss = Math.max(Math.min(rect.right, viewportW) - cropX, 1);
      cropYTop = Math.max(rect.top, 0);
      visibleHeightCss = Math.max(Math.min(rect.bottom, viewportH) - cropYTop, 1);
    }

    const total = isPage ? document.documentElement.scrollHeight : scroller.scrollHeight;
    const clientH = isPage ? viewportH : scroller.clientHeight;
    const sliceHeightCss = Math.min(visibleHeightCss, total);

    const positions = [];
    if (total <= clientH) {
      positions.push(0);
    } else {
      for (let y = 0; y < total - clientH; y += clientH) positions.push(y);
      positions.push(total - clientH);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropWidthCss * dpr);
    canvas.height = Math.round(total * dpr);
    const ctx = canvas.getContext('2d');

    try {
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        showToast(`Scrolling… ${i + 1}/${positions.length}`);
        await smoothScrollTo(scroller, isPage, p);
        await waitForPaint();
        showToast(`Capturing ${i + 1}/${positions.length}…`);
        await sleep(250); // let layout/paint + any lazy content settle, and respect capture rate limits

        const dataUrl = await captureVisibleTab();
        const img = await loadImage(dataUrl);

        const sx = cropX * dpr;
        const sy = cropYTop * dpr;
        const sw = cropWidthCss * dpr;
        const sh = sliceHeightCss * dpr;
        const dy = p * dpr;
        ctx.drawImage(img, sx, sy, sw, sh, 0, dy, sw, sh);
      }
    } finally {
      if (isPage) {
        window.scrollTo(originalScrollLeft, originalScrollTop);
      } else {
        scroller.scrollTop = originalScrollTop;
        scroller.scrollLeft = originalScrollLeft;
      }
      hideToast();
    }

    downloadCanvas(canvas, `screenshot-${Date.now()}.png`);
  }

  let picking = false;
  let hoverBox = null;

  function startPicking() {
    if (picking) return;
    picking = true;
    hoverBox = document.createElement('div');
    Object.assign(hoverBox.style, {
      position: 'fixed',
      border: '2px solid #ff5252',
      background: 'rgba(255,82,82,0.15)',
      zIndex: 2147483646,
      pointerEvents: 'none',
    });
    document.documentElement.appendChild(hoverBox);
    showToast('Click the scrollable area you want to capture (Esc to cancel)');

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function stopPicking() {
    picking = false;
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    if (hoverBox) {
      hoverBox.remove();
      hoverBox = null;
    }
    hideToast();
  }

  function onMouseMove(e) {
    const target = findScrollableAncestor(e.target) || document.scrollingElement;
    const rect = target.getBoundingClientRect ? target.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    hoverBox.style.left = rect.left + 'px';
    hoverBox.style.top = rect.top + 'px';
    hoverBox.style.width = rect.width + 'px';
    hoverBox.style.height = rect.height + 'px';
  }

  async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const target = findScrollableAncestor(e.target);
    stopPicking();
    if (target) {
      await captureScrollable(target, target, false);
    } else {
      await captureScrollable(document.scrollingElement, document.documentElement, true);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopPicking();
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'AUTO_CAPTURE') {
      const { scroller, regionEl, isPage } = detectScrollTarget();
      captureScrollable(scroller, regionEl, isPage)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (msg.type === 'CAPTURE_FULL_PAGE') {
      captureScrollable(document.scrollingElement, document.documentElement, true)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }));
      return true;
    }
    if (msg.type === 'START_ELEMENT_PICK') {
      startPicking();
      sendResponse({ ok: true });
    }
  });
})();
