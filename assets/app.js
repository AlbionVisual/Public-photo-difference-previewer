/* Photo Compare — статическое приложение.
   Никаких зависимостей: работает с GitHub Pages как есть. */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const vp = $("viewport");
  const sceneA = $("sceneA");
  const sceneB = $("sceneB");
  const topLayer = $("topLayer");
  const imgA = $("imgA");
  const imgB = $("imgB");
  const knob = $("knob");
  const knobLabel = $("knobLabel");
  const sel = $("pairSel");
  const counter = $("counter");
  const pairTitle = $("pairTitle");
  const pairFiles = $("pairFiles");
  const zoomInfo = $("zoomInfo");
  const statusEl = $("status");
  const hintEl = $("hint");

  const MAX_ZOOM = 32;
  const state = {
    pairs: [],
    idx: -1,
    pct: 50,
    scale: 1,
    tx: 0,
    ty: 0,
    baseW: 1,
    baseH: 1,
    vw: 1,
    vh: 1,
  };

  // ---------- утилиты ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function showStatus(text, ms = 0) {
    statusEl.hidden = false;
    statusEl.textContent = text;
    if (ms) setTimeout(() => (statusEl.hidden = true), ms);
  }

  function hideStatus() {
    statusEl.hidden = true;
  }

  // ---------- манифест и пары ----------
  async function loadManifest() {
    let data;
    try {
      const r = await fetch("pairs.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      data = await r.json();
    } catch (e) {
      showStatus(
        "Не удалось загрузить pairs.json. Положите пары в pairs/<имя>/ (a.jpg и b.jpg) " +
          "и запустите tools/build_manifest.py",
      );
      console.error(e);
      return;
    }
    state.pairs = Array.isArray(data) ? data : data.pairs || [];
    if (!state.pairs.length) {
      showStatus("Пары не найдены: добавьте pairs/<имя>/a.jpg и b.jpg и обновите pairs.json");
      return;
    }
    sel.innerHTML = "";
    state.pairs.forEach((p, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = p.title || p.slug || `Пара ${i + 1}`;
      sel.appendChild(o);
    });
    counter.textContent = `(${state.pairs.length})`;
    const wanted = location.hash.replace(/^#/, "");
    const start = Math.max(0, state.pairs.findIndex((p) => p.slug === wanted));
    await selectPair(start);
  }

  async function selectPair(i) {
    if (!state.pairs.length) return;
    i = clamp(i, 0, state.pairs.length - 1);
    state.idx = i;
    const p = state.pairs[i];
    sel.value = String(i);
    pairTitle.textContent = p.title || p.slug;
    pairFiles.textContent = `${p.a} ↔ ${p.b}`;
    history.replaceState(null, "", `#${encodeURIComponent(p.slug || i)}`);
    state.pct = 50;
    applyClip();

    hideStatus();
    const [a, b] = await Promise.all([loadImg(imgA, p.a), loadImg(imgB, p.b)]);
    if (!a || !b) {
      showStatus("Не удалось загрузить изображения пары. Проверьте пути в pairs.json");
      return;
    }
    if (imgA.naturalWidth !== imgB.naturalWidth || imgA.naturalHeight !== imgB.naturalHeight) {
      showStatus(
        `Внимание: размеры разные (${imgA.naturalWidth}×${imgA.naturalHeight} и ` +
          `${imgB.naturalWidth}×${imgB.naturalHeight}); второе растянуто до первого`,
        6000,
      );
    }
    fitAndReset();
  }

  function loadImg(img, src) {
    return new Promise((resolve) => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  // ---------- геометрия / зум / пан ----------
  function measure() {
    const r = vp.getBoundingClientRect();
    state.vw = Math.max(1, r.width);
    state.vh = Math.max(1, r.height);
  }

  function fitAndReset() {
    measure();
    const nw = imgA.naturalWidth || 1;
    const nh = imgA.naturalHeight || 1;
    const k = Math.min(state.vw / nw, state.vh / nh);
    state.baseW = Math.max(1, nw * k);
    state.baseH = Math.max(1, nh * k);
    // Оба изображения — в один и тот же прямоугольник; B растягивается,
    // если размеры отличаются (об этом выше предупреждение).
    for (const im of [imgA, imgB]) {
      im.style.width = `${state.baseW}px`;
      im.style.height = `${state.baseH}px`;
    }
    resetView();
  }

  function resetView() {
    state.scale = 1;
    state.tx = (state.vw - state.baseW) / 2;
    state.ty = (state.vh - state.baseH) / 2;
    applyTransform();
  }

  function clampPan() {
    const iw = state.baseW * state.scale;
    const ih = state.baseH * state.scale;
    if (iw <= state.vw) state.tx = (state.vw - iw) / 2;
    else state.tx = clamp(state.tx, state.vw - iw, 0);
    if (ih <= state.vh) state.ty = (state.vh - ih) / 2;
    else state.ty = clamp(state.ty, state.vh - ih, 0);
  }

  function applyTransform() {
    const t = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
    sceneA.style.transform = t;
    sceneB.style.transform = t;
    zoomInfo.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function zoomAt(mx, my, factor) {
    const ns = clamp(state.scale * factor, 1, MAX_ZOOM);
    const k = ns / state.scale;
    if (k === 1) return;
    state.tx = mx - (mx - state.tx) * k;
    state.ty = my - (my - state.ty) * k;
    state.scale = ns;
    clampPan();
    applyTransform();
  }

  // ---------- шторка ----------
  function setPct(p) {
    state.pct = clamp(p, 0, 100);
    applyClip();
  }

  function applyClip() {
    // clip-path в процентах от ширины СЛОЯ (слой = вьюпорт), поэтому граница
    // остаётся на месте при зуме/панораме и «противодействует» картинке.
    topLayer.style.clipPath = `inset(0 ${100 - state.pct}% 0 0)`;
    knob.style.left = `${state.pct}%`;
    knobLabel.textContent = `${Math.round(state.pct)}%`;
    knob.setAttribute("aria-valuenow", String(Math.round(state.pct)));
  }

  function slideFromClientX(clientX) {
    const r = vp.getBoundingClientRect();
    setPct(((clientX - r.left) / r.width) * 100);
  }

  // ---------- анимация «шторка двигается» ----------
  let animRAF = 0;
  function animateSweep() {
    cancelAnimationFrame(animRAF);
    const t0 = performance.now();
    const dur = 1600;
    const from = state.pct;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      // 50% → 15% → 85% → 50%
      let p;
      if (t < 0.33) p = from + (15 - from) * (t / 0.33);
      else if (t < 0.72) p = 15 + (85 - 15) * ((t - 0.33) / 0.39);
      else p = 85 + (50 - 85) * ((t - 0.72) / 0.28);
      setPct(p);
      if (t < 1) animRAF = requestAnimationFrame(step);
    };
    animRAF = requestAnimationFrame(step);
  }

  // ---------- указатели: панорама, пинч, шторка ----------
  const pointers = new Map();
  let mode = null; // "pan" | "slide"
  let pinchPrev = null;

  vp.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    if (e.target.closest("#knob")) {
      mode = "slide";
      vp.classList.add("sliding");
      vp.setPointerCapture(e.pointerId);
      slideFromClientX(e.clientX);
      e.preventDefault();
      return;
    }
    vp.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      mode = "pan";
      vp.classList.add("dragging");
    } else if (pointers.size === 2) {
      mode = "pan";
      pinchPrev = pinchState();
    }
    e.preventDefault();
  });

  vp.addEventListener("pointermove", (e) => {
    if (mode === "slide") {
      slideFromClientX(e.clientX);
      e.preventDefault();
      return;
    }
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      state.tx += dx;
      state.ty += dy;
      clampPan();
      applyTransform();
    } else if (pointers.size === 2) {
      const cur = pinchState();
      if (cur && pinchPrev) {
        const r = vp.getBoundingClientRect();
        const mx = cur.mid.x - r.left;
        const my = cur.mid.y - r.top;
        zoomAt(mx, my, cur.dist / Math.max(1, pinchPrev.dist));
        state.tx += cur.mid.x - pinchPrev.mid.x;
        state.ty += cur.mid.y - pinchPrev.mid.y;
        clampPan();
        applyTransform();
      }
      pinchPrev = cur;
    }
    e.preventDefault();
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchPrev = null;
    if (pointers.size === 0) {
      mode = null;
      vp.classList.remove("dragging", "sliding");
    }
  }
  vp.addEventListener("pointerup", endPointer);
  vp.addEventListener("pointercancel", endPointer);

  function pinchState() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      dist: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }

  // Колесо — зум к курсору
  vp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = vp.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
    },
    { passive: false },
  );

  // Двойной клик — сброс (по ползунку — в 50%)
  vp.addEventListener("dblclick", (e) => {
    if (e.target.closest("#knob")) {
      setPct(50);
      return;
    }
    resetView();
  });

  // ---------- клавиатура ----------
  window.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case "ArrowLeft":
        setPct(state.pct - step);
        e.preventDefault();
        break;
      case "ArrowRight":
        setPct(state.pct + step);
        e.preventDefault();
        break;
      case "+":
      case "=":
        zoomAt(state.vw / 2, state.vh / 2, 1.25);
        e.preventDefault();
        break;
      case "-":
        zoomAt(state.vw / 2, state.vh / 2, 0.8);
        e.preventDefault();
        break;
      case "0":
        resetView();
        break;
      case "a":
      case "A":
      case "ф":
      case "Ф":
        animateSweep();
        break;
      case "n":
      case "N":
      case "т":
      case "Т":
        selectPair(state.idx + 1);
        break;
      case "p":
      case "P":
      case "з":
      case "З":
        selectPair(state.idx - 1);
        break;
    }
  });

  // ---------- кнопки/селект ----------
  sel.addEventListener("change", () => selectPair(Number(sel.value)));
  $("prev").addEventListener("click", () => selectPair(state.idx - 1));
  $("next").addEventListener("click", () => selectPair(state.idx + 1));
  $("reset").addEventListener("click", resetView);
  $("anim").addEventListener("click", animateSweep);

  let rt = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (imgA.naturalWidth && state.pairs.length) fitAndReset();
    }, 150);
  });

  // прячем подсказку через 6 секунд
  setTimeout(() => {
    hintEl.style.opacity = "0";
  }, 6000);

  loadManifest();
})();
