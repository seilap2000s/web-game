(() => {
  "use strict";

  const TOTAL_ROUNDS = 10;
  const STORAGE_KEY = "girigiri-inc-highscore";
  const REDUCE_MOTION = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const JUDGE_COPY = {
    PERFECT: "稟議一発承認",
    GREAT: "ほぼ想定内",
    NICE: "無難な着地",
    SAFE: "まだ余裕",
    OUT: "超過。始末書",
  };

  const ROUNDS = [
    {
      special: "normal",
      speed: 0.34,
      flavor: "朝礼",
      kicker: "案件 01",
      sub: "まずは無難に。直前で止めろ。",
      danger: [0.78, 0.88],
    },
    {
      special: "normal",
      speed: 0.42,
      flavor: "メール返信",
      kicker: "案件 02",
      sub: "既読スルー禁止。",
      danger: [0.76, 0.9],
    },
    {
      special: "rush",
      speed: 0.36,
      rushAt: 0.52,
      rushMul: 2.5,
      flavor: "締切",
      kicker: "特殊：急加速",
      sub: "後半、突然速くなる。",
      danger: [0.74, 0.88],
    },
    {
      special: "normal",
      speed: 0.5,
      flavor: "評価面談",
      kicker: "上司の圧",
      sub: "速度が上がっています。",
      danger: [0.78, 0.9],
    },
    {
      special: "reverse",
      speed: 0.4,
      revPeak: 0.52,
      revBack: 0.22,
      revMul: 1.85,
      flavor: "差し戻し",
      kicker: "特殊：逆走",
      sub: "一度戻ってから再提出。",
      danger: [0.76, 0.9],
    },
    {
      special: "normal",
      speed: 0.56,
      flavor: "残業",
      kicker: "案件 06",
      sub: "テンポが速い。",
      danger: [0.8, 0.92],
    },
    {
      special: "blackout",
      speed: 0.46,
      blackoutBefore: 0.16,
      blackoutMs: 520,
      flavor: "停電",
      kicker: "特殊：暗転",
      sub: "直前でゲージが見えなくなる。",
      danger: [0.76, 0.9],
    },
    {
      special: "fake",
      speed: 0.48,
      flavor: "稟議",
      kicker: "特殊：フェイク",
      sub: "金色が本番。破線は下書き。",
      danger: [0.78, 0.92],
    },
    {
      special: "rush",
      speed: 0.42,
      rushAt: 0.48,
      rushMul: 2.8,
      flavor: "最終確認",
      kicker: "特殊：急加速",
      sub: "もう一度、急加速。",
      danger: [0.8, 0.92],
    },
    {
      special: "fake",
      speed: 0.58,
      flavor: "社長前",
      kicker: "特殊：フェイク",
      sub: "本番ラインを見極めろ。",
      danger: [0.82, 0.93],
    },
  ];

  const el = {
    cabinet: document.getElementById("cabinet"),
    title: document.getElementById("screen-title"),
    play: document.getElementById("screen-play"),
    result: document.getElementById("screen-result"),
    titleBtn: document.getElementById("title-btn"),
    playBtn: document.getElementById("play-btn"),
    retryBtn: document.getElementById("retry-btn"),
    copyBtn: document.getElementById("copy-btn"),
    titleHigh: document.getElementById("title-high"),
    hudRound: document.getElementById("hud-round"),
    hudScore: document.getElementById("hud-score"),
    hudCombo: document.getElementById("hud-combo"),
    missionKicker: document.getElementById("mission-kicker"),
    missionTitle: document.getElementById("mission-title"),
    missionSub: document.getElementById("mission-sub"),
    fill: document.getElementById("gauge-fill"),
    needle: document.getElementById("gauge-needle"),
    danger: document.getElementById("gauge-danger"),
    fake: document.getElementById("gauge-fake"),
    gaugeBlock: document.getElementById("gauge-block"),
    blackout: document.getElementById("blackout"),
    judge: document.getElementById("judge"),
    judgeRank: document.getElementById("judge-rank"),
    judgeDetail: document.getElementById("judge-detail"),
    resultTitle: document.getElementById("result-title"),
    resultScore: document.getElementById("result-score"),
    resultHigh: document.getElementById("result-high"),
    resultCombo: document.getElementById("result-combo"),
    resultPerfect: document.getElementById("result-perfect"),
    newBest: document.getElementById("new-best"),
    copyStatus: document.getElementById("copy-status"),
    shareBox: document.getElementById("share-box"),
    terminalNo: document.getElementById("terminalNo"),
  };

  const state = {
    screen: "title",
    roundIndex: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    round: null,
    running: false,
    inputLocked: false,
    startedAt: 0,
    raf: 0,
    blackoutArmed: false,
    hiddenAt: 0,
    gen: 0,
    outCount: 0,
    lastShare: "",
  };

  const timers = {
    ready: null,
    judge: null,
    blackout: null,
  };

  function now() {
    return performance.now();
  }

  function clearTimer(name) {
    const t = timers[name];
    if (!t) return;
    if (t.id) window.clearTimeout(t.id);
    timers[name] = null;
  }

  function clearAllTimers() {
    Object.keys(timers).forEach(clearTimer);
  }

  function scheduleTimer(name, delay, fn) {
    clearTimer(name);
    const entry = {
      fn,
      remaining: Math.max(0, delay),
      started: now(),
      id: 0,
    };
    timers[name] = entry;
    if (state.hiddenAt) return;
    entry.id = window.setTimeout(() => {
      timers[name] = null;
      fn();
    }, entry.remaining);
  }

  function pauseForBackground() {
    if (state.hiddenAt) return;
    state.hiddenAt = now();
    if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
    Object.keys(timers).forEach((name) => {
      const t = timers[name];
      if (!t) return;
      if (t.id) {
        window.clearTimeout(t.id);
        t.id = 0;
      }
      t.remaining = Math.max(0, t.remaining - (state.hiddenAt - t.started));
    });
  }

  function resumeFromBackground() {
    const hiddenAt = state.hiddenAt;
    state.hiddenAt = 0;
    if (!hiddenAt) return;
    const hiddenFor = Math.max(0, now() - hiddenAt);
    if (state.running) {
      state.startedAt += hiddenFor;
    }
    Object.keys(timers).forEach((name) => {
      const t = timers[name];
      if (!t) return;
      t.started = now();
      t.id = window.setTimeout(() => {
        timers[name] = null;
        t.fn();
      }, t.remaining);
    });
    if (state.running && state.screen === "play") {
      state.raf = requestAnimationFrame(tick);
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function loadHigh() {
    try {
      const n = Number(localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch {
      return 0;
    }
  }

  function saveHigh(score) {
    try {
      localStorage.setItem(STORAGE_KEY, String(score));
    } catch {
      /* private mode */
    }
  }

  function comboMul(combo) {
    if (combo <= 1) return 1;
    return Math.min(3, 1 + (combo - 1) * 0.25);
  }

  function titleFor(score, perfects, outCount) {
    if (outCount >= 7) return "試用期間延長";
    if (score >= 16000 && perfects >= 4) return "社長賞";
    if (score >= 13000) return "残業の鬼";
    if (score >= 10000) return "稟議の達人";
    if (score >= 7000) return "ギリギリ係長";
    if (score >= 4000) return "普通の社員";
    return "試用期間中";
  }

  function makeRound(index) {
    const src = ROUNDS[index];
    const danger = lerp(src.danger[0], src.danger[1], Math.random());
    let fake = null;
    if (src.special === "fake") {
      const before = Math.random() < 0.68;
      fake = before
        ? danger - (0.09 + Math.random() * 0.07)
        : danger + (0.06 + Math.random() * 0.05);
      fake = clamp(fake, 0.42, 0.97);
      if (Math.abs(fake - danger) < 0.07) {
        fake = clamp(danger - 0.11, 0.4, 0.95);
      }
    }
    return { ...src, index, danger, fake };
  }

  function velocityAt(elapsed, round) {
    if (round.special === "rush") {
      const tSplit = round.rushAt / round.speed;
      return elapsed < tSplit ? round.speed : round.speed * round.rushMul;
    }
    if (round.special === "reverse") {
      const t1 = round.revPeak / round.speed;
      const t2 = t1 + (round.revPeak - round.revBack) / (round.speed * 0.9);
      if (elapsed < t1) return round.speed;
      if (elapsed < t2) return -round.speed * 0.9;
      return round.speed * round.revMul;
    }
    return round.speed;
  }

  function positionAt(elapsed, round) {
    if (round.special === "rush") {
      const tSplit = round.rushAt / round.speed;
      if (elapsed <= tSplit) return elapsed * round.speed;
      return round.rushAt + (elapsed - tSplit) * round.speed * round.rushMul;
    }
    if (round.special === "reverse") {
      const t1 = round.revPeak / round.speed;
      const t2 = t1 + (round.revPeak - round.revBack) / (round.speed * 0.9);
      if (elapsed <= t1) return elapsed * round.speed;
      if (elapsed <= t2) {
        return round.revPeak - (elapsed - t1) * round.speed * 0.9;
      }
      return round.revBack + (elapsed - t2) * round.speed * round.revMul;
    }
    return elapsed * round.speed;
  }

  function judge(pos, danger, speed) {
    if (pos > danger) {
      return { rank: "OUT", base: 0, gap: pos - danger };
    }
    const gap = danger - pos;
    const early = gap / Math.max(speed, 0.2);
    if (early <= 0.055) return { rank: "PERFECT", base: 1000, gap };
    if (early <= 0.12) return { rank: "GREAT", base: 700, gap };
    if (early <= 0.22) return { rank: "NICE", base: 400, gap };
    return { rank: "SAFE", base: 150, gap };
  }

  function showScreen(name) {
    state.screen = name;
    el.title.classList.toggle("is-hidden", name !== "title");
    el.play.classList.toggle("is-hidden", name !== "play");
    el.result.classList.toggle("is-hidden", name !== "result");
  }

  function setGauge(pos) {
    const pct = clamp(pos, 0, 1) * 100;
    el.fill.style.width = pct + "%";
    el.needle.style.left = pct + "%";
  }

  function updateHud() {
    el.hudRound.textContent = `${pad2(state.roundIndex + 1)} / ${pad2(TOTAL_ROUNDS)}`;
    el.hudScore.textContent = String(state.score);
    el.hudCombo.textContent = `×${comboMul(Math.max(state.combo, 1)).toFixed(1)}`;
  }

  function setLine(node, pos, hidden) {
    if (hidden || pos == null) {
      node.hidden = true;
      return;
    }
    node.hidden = false;
    node.style.left = clamp(pos, 0, 1) * 100 + "%";
  }

  function clearFx() {
    el.cabinet.classList.remove("is-hot", "is-shake", "is-flash");
    el.gaugeBlock.classList.remove("is-blackout");
    el.blackout.hidden = true;
    el.judge.hidden = true;
  }

  function startGame() {
    cancelAnimationFrame(state.raf);
    clearAllTimers();
    hideManualShare();
    state.gen += 1;
    state.roundIndex = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.perfects = 0;
    state.outCount = 0;
    state.running = false;
    showScreen("play");
    startRound();
  }

  function startRound() {
    cancelAnimationFrame(state.raf);
    clearTimer("blackout");
    clearFx();
    state.round = makeRound(state.roundIndex);
    state.running = false;
    state.inputLocked = true;
    state.blackoutArmed = state.round.special === "blackout";
    setGauge(0);
    setLine(el.danger, state.round.danger, false);
    setLine(el.fake, state.round.fake, state.round.special !== "fake");
    el.missionKicker.textContent = state.round.kicker;
    el.missionTitle.textContent = state.round.flavor;
    el.missionSub.textContent = state.round.sub;
    el.playBtn.disabled = true;
    el.playBtn.textContent = "READY";
    updateHud();

    const gen = state.gen;
    scheduleTimer("ready", state.roundIndex === 0 ? 700 : 480, () => {
      if (state.gen !== gen || state.screen !== "play") return;
      state.inputLocked = false;
      state.running = true;
      state.startedAt = now();
      el.playBtn.disabled = false;
      el.playBtn.textContent = "STOP!";
      state.raf = requestAnimationFrame(tick);
    });
  }

  function tick(frameNow) {
    if (!state.running || state.hiddenAt) return;
    const elapsed = Math.max(0, (frameNow - state.startedAt) / 1000);
    const pos = positionAt(elapsed, state.round);
    setGauge(pos);

    if (pos >= state.round.danger * 0.72) {
      el.cabinet.classList.add("is-hot");
    }

    if (
      state.blackoutArmed &&
      pos >= state.round.danger - state.round.blackoutBefore
    ) {
      state.blackoutArmed = false;
      el.gaugeBlock.classList.add("is-blackout");
      el.blackout.hidden = false;
      const gen = state.gen;
      scheduleTimer("blackout", REDUCE_MOTION ? 280 : state.round.blackoutMs, () => {
        if (state.gen !== gen || !state.running) return;
        el.gaugeBlock.classList.remove("is-blackout");
        el.blackout.hidden = true;
      });
    }

    if (pos >= 1) {
      resolveStop(1);
      return;
    }
    state.raf = requestAnimationFrame(tick);
  }

  function resolveStop(forcedPos) {
    if (!state.running) return;
    state.running = false;
    state.inputLocked = true;
    cancelAnimationFrame(state.raf);
    clearTimer("blackout");

    const elapsed = Math.max(0, (now() - state.startedAt) / 1000);
    const pos =
      forcedPos == null ? clamp(positionAt(elapsed, state.round), 0, 1) : forcedPos;
    const spd = Math.abs(velocityAt(elapsed, state.round));
    setGauge(pos);
    el.gaugeBlock.classList.remove("is-blackout");
    el.blackout.hidden = true;

    const result = judge(pos, state.round.danger, spd);
    let gained = 0;
    if (result.rank === "OUT") {
      state.combo = 0;
      state.outCount = (state.outCount || 0) + 1;
      if (!REDUCE_MOTION) el.cabinet.classList.add("is-shake");
    } else {
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const mul = comboMul(state.combo);
      gained = Math.round(result.base * mul);
      state.score += gained;
      if (result.rank === "PERFECT") {
        state.perfects += 1;
        if (!REDUCE_MOTION) el.cabinet.classList.add("is-flash");
      }
    }

    updateHud();
    el.judge.hidden = false;
    el.judge.className = "judge is-" + result.rank.toLowerCase();
    el.judgeRank.textContent = result.rank;
    el.judgeDetail.textContent =
      result.rank === "OUT"
        ? JUDGE_COPY.OUT
        : `${JUDGE_COPY[result.rank]} +${gained}`;
    el.playBtn.disabled = true;

    const gen = state.gen;
    scheduleTimer("judge", 820, () => {
      if (state.gen !== gen) return;
      el.cabinet.classList.remove("is-shake", "is-flash", "is-hot");
      if (state.roundIndex >= TOTAL_ROUNDS - 1) {
        finishGame();
        return;
      }
      state.roundIndex += 1;
      startRound();
    });
  }

  function finishGame() {
    cancelAnimationFrame(state.raf);
    const high = loadHigh();
    const isBest = state.score > high;
    const nextHigh = isBest ? state.score : high;
    if (isBest) saveHigh(state.score);

    const title = titleFor(state.score, state.perfects, state.outCount || 0);
    el.resultTitle.textContent = title;
    el.resultScore.textContent = String(state.score);
    el.resultHigh.textContent = String(nextHigh);
    el.resultCombo.textContent = `${state.maxCombo}連続`;
    el.resultPerfect.textContent = String(state.perfects);
    el.newBest.classList.toggle("is-hidden", !isBest);
    hideManualShare();
    el.copyStatus.hidden = true;
    state.lastShare = [
      "【ギリギリ株式会社】勤務結果",
      `SCORE ${state.score}  称号: ${title}`,
      `最高連続 ${state.maxCombo} / PERFECT ${state.perfects}`,
      "今日もギリギリ。",
    ].join("\n");
    el.titleHigh.textContent = String(nextHigh);
    showScreen("result");
    state.inputLocked = false;
  }

  function retry() {
    startGame();
  }

  function hideManualShare() {
    if (!el.shareBox) return;
    el.shareBox.hidden = true;
    el.shareBox.value = "";
    el.copyStatus.classList.remove("is-fail");
  }

  function showManualShare(text) {
    el.copyStatus.hidden = false;
    el.copyStatus.classList.add("is-fail");
    el.copyStatus.textContent = "コピー失敗。下の文を長押しして選択してください。";
    el.shareBox.hidden = false;
    el.shareBox.value = text;
    el.shareBox.focus();
    el.shareBox.select();
  }

  function showCopySuccess() {
    hideManualShare();
    el.copyStatus.hidden = false;
    el.copyStatus.textContent = "コピーした。貼って共有せよ。";
  }

  function fallbackCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok === true;
  }

  async function copyResult() {
    const text = state.lastShare || "【ギリギリ株式会社】";
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showCopySuccess();
        return;
      }
    } catch {
      /* use fallback */
    }
    let copied = false;
    try {
      copied = fallbackCopy(text);
    } catch {
      copied = false;
    }
    if (copied) {
      showCopySuccess();
      return;
    }
    showManualShare(text);
  }

  function onPrimary(fromCopy) {
    if (fromCopy) return;
    if (state.screen === "title") {
      startGame();
      return;
    }
    if (state.screen === "result") {
      retry();
      return;
    }
    if (state.screen === "play" && state.running && !state.inputLocked) {
      resolveStop();
    }
  }

  function bindInput() {
    const press = (node, fn) => {
      node.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        node.classList.add("is-down");
        fn(event);
      });
      node.addEventListener("pointerup", () => node.classList.remove("is-down"));
      node.addEventListener("pointerleave", () => node.classList.remove("is-down"));
      node.addEventListener("click", (event) => event.preventDefault());
    };

    press(el.titleBtn, () => onPrimary());
    press(el.playBtn, () => {
      if (el.playBtn.disabled) return;
      onPrimary();
    });
    press(el.retryBtn, () => onPrimary());
    press(el.copyBtn, () => {
      copyResult();
    });

    document.addEventListener("keydown", (event) => {
      if (event.repeat) return;
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (event.target && event.target.tagName === "TEXTAREA") return;
      event.preventDefault();
      if (state.screen === "result" && event.code === "Enter" && document.activeElement === el.copyBtn) {
        copyResult();
        return;
      }
      onPrimary();
    });
  }

  function boot() {
    el.terminalNo.textContent = "TERM-" + pad2(7 + Math.floor(Math.random() * 20));
    el.titleHigh.textContent = String(loadHigh());
    bindInput();
    window.addEventListener("resize", () => {
      if (!state.round) return;
      setLine(el.danger, state.round.danger, false);
      setLine(el.fake, state.round.fake, state.round.special !== "fake");
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseForBackground();
      else resumeFromBackground();
    });
    const workerCard = document.getElementById("worker-card");
    const workerImg = workerCard && workerCard.querySelector("img");
    if (workerCard && workerImg) {
      const hideArt = () => {
        workerCard.hidden = true;
      };
      workerImg.addEventListener("error", hideArt);
      if (workerImg.complete && workerImg.naturalWidth === 0) hideArt();
    }
  }

  boot();
})();
