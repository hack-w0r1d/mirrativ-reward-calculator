(() => {
  "use strict";

  // 還元率（整数の分数で持つことで、浮動小数点の誤差を避ける）
  const RATES = {
    free: { numerator: 3, denominator: 10, label: "30%" },
    paid: { numerator: 9, denominator: 10, label: "90%" },
  };

  const MAX_DIGITS = 9;
  const TWEEN_MS = 250;

  const $ = (id) => document.getElementById(id);

  const inputs = {
    free: $("free-input"),
    paid: $("paid-input"),
  };
  const outputs = {
    free: { value: $("free-return"), formula: $("free-formula") },
    paid: { value: $("paid-return"), formula: $("paid-formula") },
  };
  const totalEl = $("total-return");
  const statusEl = $("status");
  const resetButton = $("reset-button");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const formatNumber = (n) => n.toLocaleString("ja-JP");

  // ---- 計算 ----
  const calcReturn = (amount, rate) =>
    Math.floor((amount * rate.numerator) / rate.denominator);

  // ---- 入力の整形 ----
  const toHalfWidth = (s) =>
    s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));

  const digitsOnly = (s) => toHalfWidth(s).replace(/\D/g, "");

  const sanitize = (s) =>
    digitsOnly(s).slice(0, MAX_DIGITS).replace(/^0+(?=\d)/, "");

  const groupDigits = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const parseAmount = (input) => Number(sanitize(input.value)) || 0;

  const formatInput = (input) => {
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const clean = sanitize(raw);
    const formatted = groupDigits(clean);
    if (formatted === raw) return;

    const digitsBeforeCaret = Math.min(
      digitsOnly(raw.slice(0, caret)).length,
      clean.length
    );
    input.value = formatted;

    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < digitsBeforeCaret) {
      if (formatted[pos] !== ",") seen += 1;
      pos += 1;
    }
    input.setSelectionRange(pos, pos);
  };

  // ---- 合計値のアニメーション ----
  const tween = { value: 0, frame: 0 };

  const setTotal = (to) => {
    totalEl.dataset.long = String(formatNumber(to).length > 9);
    cancelAnimationFrame(tween.frame);

    const from = tween.value;
    if (reduceMotion.matches || from === to) {
      tween.value = to;
      totalEl.textContent = formatNumber(to);
      return;
    }

    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / TWEEN_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      tween.value = progress === 1 ? to : Math.round(from + (to - from) * eased);
      totalEl.textContent = formatNumber(tween.value);
      if (progress < 1) tween.frame = requestAnimationFrame(step);
    };
    tween.frame = requestAnimationFrame(step);
  };

  // ---- スクリーンリーダー向けの読み上げ（入力が止まってから更新） ----
  let statusTimer = 0;
  const announce = (total) => {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      statusEl.textContent = `盛り上がりコインは合計${formatNumber(total)}コインです。`;
    }, 500);
  };

  // ---- 描画 ----
  const render = ({ silent = false } = {}) => {
    let total = 0;

    Object.keys(RATES).forEach((kind) => {
      const amount = parseAmount(inputs[kind]);
      const returned = calcReturn(amount, RATES[kind]);
      total += returned;
      outputs[kind].value.textContent = formatNumber(returned);
      outputs[kind].formula.textContent = `${formatNumber(amount)} × ${RATES[kind].label}`;
    });

    setTotal(total);
    if (!silent) announce(total);
  };

  // ---- イベント ----
  Object.values(inputs).forEach((input) => {
    input.addEventListener("input", (e) => {
      // IME変換中は値を書き換えない（全角数字の入力を壊さないため）
      if (!e.isComposing) formatInput(input);
      render();
    });
    input.addEventListener("compositionend", () => {
      formatInput(input);
      render();
    });
  });

  resetButton.addEventListener("click", () => {
    Object.values(inputs).forEach((input) => {
      input.value = "";
    });
    render();
    inputs.free.focus();
  });

  render({ silent: true });
})();
