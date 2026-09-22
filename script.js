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
  const addButtons = {
    free: $("free-add"),
    paid: $("paid-add"),
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
    s.replace(/[０-９＋]/g, (ch) =>
      ch === "＋" ? "+" : String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
    );

  // 数字と「+」だけを残す（全角は半角に変換済み）
  const contentOnly = (s) => toHalfWidth(s).replace(/[^\d+]/g, "");

  // 「+」区切りの各項を整形する（桁数上限・先頭0の除去・連続する+や先頭の+を吸収）
  const sanitize = (s) => {
    const cleaned = contentOnly(s);
    const endsWithPlus = cleaned.endsWith("+") && cleaned !== "+";
    const terms = cleaned
      .split("+")
      .map((term) => term.slice(0, MAX_DIGITS).replace(/^0+(?=\d)/, ""))
      .filter((term) => term !== "");
    if (terms.length === 0) return "";
    return terms.join("+") + (endsWithPlus ? "+" : "");
  };

  const groupDigits = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // 「+」区切りの各項にカンマ区切りを適用する
  const formatAmountString = (clean) =>
    clean.split("+").map(groupDigits).join("+");

  // 「+」区切りの各項を合計した数値を返す
  const parseAmount = (input) => {
    const terms = sanitize(input.value).split("+").filter(Boolean);
    return terms.reduce((sum, term) => sum + Number(term), 0);
  };

  const formatInput = (input) => {
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const clean = sanitize(raw);
    const formatted = formatAmountString(clean);
    if (formatted === raw) return;

    const contentBeforeCaret = Math.min(
      contentOnly(raw.slice(0, caret)).length,
      clean.length
    );
    input.value = formatted;

    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < contentBeforeCaret) {
      if (formatted[pos] !== ",") seen += 1;
      pos += 1;
    }
    input.setSelectionRange(pos, pos);
  };

  // 入力にフォーカスがあり、末尾が数字のときだけ「+」ボタンを表示する
  const updateAddButton = (kind) => {
    const input = inputs[kind];
    const focused = document.activeElement === input;
    addButtons[kind].hidden = !(focused && /\d$/.test(contentOnly(input.value)));
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
  Object.keys(inputs).forEach((kind) => {
    const input = inputs[kind];

    input.addEventListener("input", (e) => {
      // IME変換中は値を書き換えない（全角数字の入力を壊さないため）
      if (!e.isComposing) formatInput(input);
      updateAddButton(kind);
      render();
    });
    input.addEventListener("compositionend", () => {
      formatInput(input);
      updateAddButton(kind);
      render();
    });
    input.addEventListener("focus", () => updateAddButton(kind));
    input.addEventListener("blur", (e) => {
      // +ボタンへのフォーカス移動（Tab操作）のときは隠さない
      if (e.relatedTarget === addButtons[kind]) return;
      updateAddButton(kind);
    });

    addButtons[kind].addEventListener("blur", () => updateAddButton(kind));
    // mousedownの既定動作（フォーカス移動）を止め、押しても入力欄のフォーカスが外れないようにする
    addButtons[kind].addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    addButtons[kind].addEventListener("click", () => {
      if (!/\d$/.test(contentOnly(input.value))) return;
      input.value = formatAmountString(sanitize(input.value) + "+");
      updateAddButton(kind);
      render();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  resetButton.addEventListener("click", () => {
    Object.keys(inputs).forEach((kind) => {
      inputs[kind].value = "";
      updateAddButton(kind);
    });
    render();
    inputs.free.focus();
  });

  Object.keys(inputs).forEach(updateAddButton);
  render({ silent: true });
})();
