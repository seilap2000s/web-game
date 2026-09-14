const TOTAL_ROUNDS = 10;
const DANGER_POINT = 88;
const HIGH_SCORE_KEY = 'girigiri-kaisha-high-score';

const qs = (selector) => document.querySelector(selector);

const startScreen = qs('#start-screen');
const gameScreen = qs('#game-screen');
const resultScreen = qs('#result-screen');
const startButton = qs('#start-button');
const retryButton = qs('#retry-button');
const copyButton = qs('#copy-button');
const stopButton = qs('#stop-button');
const roundLabel = qs('#round-label');
const scoreLabel = qs('#score-label');
const roundModeLabel = qs('#round-mode-label');
const comboLabel = qs('#combo-label');
const roundTitle = qs('#round-title');
const roundCopy = qs('#round-copy');
const meterRunner = qs('#meter-runner');
const meterFill = qs('#meter-fill');
const fakeDangerBand = qs('#fake-danger-band');
const blackout = qs('#blackout');
const judgement = qs('#judgement');
const judgementScore = qs('#judgement-score');
const roundProgress = qs('#round-progress');
const app = qs('#app');

const modes = [
  { id: 'normal', label: '通常勤務', title: '限界まで攻めろ', copy: '危険ラインの直前でSTOP。', speed: 24 },
  { id: 'normal', label: '月曜 09:01', title: 'まだ肩慣らしだ', copy: '昨日より1mm、攻めてみよう。', speed: 29 },
  { id: 'boost', label: '急な仕様変更', title: '後半、急加速', copy: '「簡単な修正です」と言われました。', speed: 25 },
  { id: 'fake', label: '稟議迷路', title: '偽物に惑わされるな', copy: '点線はダミー。本物は赤い実線。', speed: 31 },
  { id: 'reverse', label: '差し戻し', title: '一度、戻ります', copy: '承認されたと思った？差し戻しです。', speed: 32 },
  { id: 'blackout', label: '画面共有', title: '見えなくても止めろ', copy: '大事なところだけ一瞬見えません。', speed: 29 },
  { id: 'boost', label: '残業モード', title: '定時が逃げていく', copy: '後半の加速率が上がっています。', speed: 31, boost: 2.15 },
  { id: 'fake', label: '上司の圧', title: '線は2本。正解は1本。', copy: '焦ると、だいたい負ける。', speed: 36 },
  { id: 'reverse', label: '再々提出', title: '戻って、また来る', copy: '2回目こそが本番です。', speed: 37 },
  { id: 'blackoutBoost', label: '最終査定', title: '全部乗せ', copy: '見えない。速い。でも評価は欲しい。', speed: 34, boost: 2.05 }
];

let state = {};
let frameId = null;
let roundTimer = null;

function resetState() {
  cancelAnimationFrame(frameId);
  clearTimeout(roundTimer);
  state = {
    round: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    perfects: 0,
    outs: 0,
    progress: 0,
    running: false,
    direction: 1,
    reversedOnce: false,
    reverseCompleted: false,
    lastTime: 0,
    results: []
  };
}

function showScreen(target) {
  [startScreen, gameScreen, resultScreen].forEach((screen) => screen.classList.remove('is-active'));
  target.classList.add('is-active');
}

function buildRoundProgress() {
  roundProgress.innerHTML = '';
  for (let i = 0; i < TOTAL_ROUNDS; i += 1) {
    const dot = document.createElement('span');
    roundProgress.appendChild(dot);
  }
}

function startGame() {
  resetState();
  buildRoundProgress();
  showScreen(gameScreen);
  startRound();
}

function startRound() {
  if (state.round >= TOTAL_ROUNDS) {
    finishGame();
    return;
  }

  const mode = modes[state.round];
  state.progress = 0;
  state.direction = 1;
  state.reversedOnce = false;
  state.reverseCompleted = false;
  state.running = false;
  state.lastTime = 0;

  updateMeter(0);
  fakeDangerBand.classList.toggle('is-visible', mode.id === 'fake');
  blackout.classList.remove('is-visible');
  judgement.className = 'judgement';
  judgement.textContent = 'READY';
  judgementScore.innerHTML = '&nbsp;';
  stopButton.disabled = true;

  roundLabel.textContent = `${String(state.round + 1).padStart(2, '0')} / ${TOTAL_ROUNDS}`;
  scoreLabel.textContent = state.score.toLocaleString('ja-JP');
  comboLabel.textContent = `COMBO x${Math.max(1, state.combo)}`;
  roundModeLabel.textContent = mode.label;
  roundTitle.textContent = mode.title;
  roundCopy.textContent = mode.copy;

  roundTimer = window.setTimeout(() => {
    state.running = true;
    stopButton.disabled = false;
    judgement.textContent = 'GO';
    state.lastTime = performance.now();
    frameId = requestAnimationFrame(tick);
  }, state.round === 0 ? 900 : 650);
}

function tick(now) {
  if (!state.running) return;

  const mode = modes[state.round];
  const delta = Math.min(40, now - state.lastTime) / 1000;
  state.lastTime = now;

  let speed = mode.speed;
  const isBoost = mode.id === 'boost' || mode.id === 'blackoutBoost';
  if (isBoost && state.progress > 57) speed *= mode.boost || 1.85;

  if (mode.id === 'reverse') {
    if (!state.reversedOnce && state.progress >= 73) {
      state.direction = -1;
      state.reversedOnce = true;
      flashMessage('差し戻し');
    } else if (state.reversedOnce && !state.reverseCompleted && state.progress <= 43) {
      state.direction = 1;
      state.reverseCompleted = true;
      flashMessage('再提出');
    }
  }

  state.progress += speed * delta * state.direction;
  state.progress = Math.max(0, state.progress);

  const shouldBlackout = (mode.id === 'blackout' || mode.id === 'blackoutBoost') && state.progress > 62 && state.progress < 80;
  blackout.classList.toggle('is-visible', shouldBlackout);

  updateMeter(state.progress);

  if (state.progress >= 100) {
    state.progress = 100;
    stopRound(true);
    return;
  }

  frameId = requestAnimationFrame(tick);
}

function updateMeter(progress) {
  const shown = Math.max(0, Math.min(100, progress));
  meterRunner.style.left = `${shown}%`;
  meterFill.style.width = `${shown}%`;
}

function flashMessage(text) {
  judgement.textContent = text;
  app.classList.remove('shake');
  void app.offsetWidth;
  app.classList.add('shake');
  window.setTimeout(() => {
    if (state.running) judgement.textContent = 'GO';
  }, 380);
}

function stopRound(auto = false) {
  if (!state.running) return;

  state.running = false;
  stopButton.disabled = true;
  cancelAnimationFrame(frameId);
  blackout.classList.remove('is-visible');

  const value = state.progress;
  const result = judge(value);
  const comboBefore = state.combo;

  if (result.name === 'OUT') {
    state.combo = 0;
    state.outs += 1;
    vibrate([45, 40, 65]);
  } else {
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    if (result.name === 'PERFECT') {
      state.perfects += 1;
      vibrate(28);
    }
  }

  const multiplier = result.name === 'OUT' ? 0 : 1 + Math.min(comboBefore, 5) * 0.12;
  const gained = Math.round(result.points * multiplier);
  state.score += gained;
  state.results.push(result.name);

  judgement.className = `judgement ${result.className}`;
  judgement.textContent = result.name;
  judgementScore.textContent = result.name === 'OUT'
    ? auto ? '押す前に勤務終了。+0' : 'ライン超過。+0'
    : `+${gained.toLocaleString('ja-JP')} / ${Math.max(0, DANGER_POINT - value).toFixed(1)}pt手前`;

  scoreLabel.textContent = state.score.toLocaleString('ja-JP');
  comboLabel.textContent = `COMBO x${Math.max(1, state.combo)}`;
  markRound(result.name === 'OUT');

  state.round += 1;
  roundTimer = window.setTimeout(startRound, 1250);
}

function judge(value) {
  if (value >= DANGER_POINT) return { name: 'OUT', points: 0, className: 'out' };
  const gap = DANGER_POINT - value;
  if (gap <= 1.2) return { name: 'PERFECT', points: 1000, className: 'perfect' };
  if (gap <= 3.5) return { name: 'GREAT', points: 720, className: 'great' };
  if (gap <= 7.5) return { name: 'NICE', points: 460, className: 'nice' };
  return { name: 'SAFE', points: 220, className: '' };
}

function markRound(failed) {
  const dots = [...roundProgress.children];
  const index = state.round;
  if (dots[index]) dots[index].classList.add(failed ? 'failed' : 'done');
}

function finishGame() {
  clearTimeout(roundTimer);
  cancelAnimationFrame(frameId);
  state.running = false;

  const previousHigh = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  const highScore = Math.max(previousHigh, state.score);
  localStorage.setItem(HIGH_SCORE_KEY, String(highScore));

  const rank = getRank(state.score, state.outs, state.perfects);
  qs('#rank-title').textContent = rank.title;
  qs('#rank-copy').textContent = rank.copy;
  qs('#final-score').textContent = state.score.toLocaleString('ja-JP');
  qs('#high-score-note').textContent = state.score > previousHigh && state.score > 0
    ? `NEW HIGH SCORE ${highScore.toLocaleString('ja-JP')}`
    : `HIGH SCORE ${highScore.toLocaleString('ja-JP')}`;
  qs('#perfect-count').textContent = state.perfects;
  qs('#best-combo').textContent = state.bestCombo;
  qs('#out-count').textContent = state.outs;
  qs('#copy-status').textContent = '';

  showScreen(resultScreen);
}

function getRank(score, outs, perfects) {
  if (perfects >= 4 && outs <= 1) return { title: '代表取締役 ギリギリ', copy: '安全圏を知らないのに、なぜか会社は回っている。' };
  if (score >= 7200) return { title: '執行役員・攻め担当', copy: '危険ラインとの距離感だけで昇進した人。' };
  if (score >= 5400) return { title: 'ギリギリ課長', copy: '部下には「余裕を持て」と言うタイプ。' };
  if (score >= 3600) return { title: '攻める一般社員', copy: '無難と無茶のあいだを歩く人。' };
  if (outs >= 5) return { title: '始末書エース', copy: '攻めた。その事実だけは誰にも奪えない。' };
  return { title: '定時退社の守護者', copy: '安全第一。それも立派な才能です。' };
}

async function copyResult() {
  const rank = qs('#rank-title').textContent;
  const text = `『ギリギリ株式会社』で${state.score.toLocaleString('ja-JP')}点。称号は「${rank}」でした。PERFECT ${state.perfects}回 / BEST COMBO ${state.bestCombo}。`;
  const status = qs('#copy-status');

  try {
    await navigator.clipboard.writeText(text);
    status.textContent = '結果をコピーしました。';
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    status.textContent = '結果をコピーしました。';
  }
}

function vibrate(pattern) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}

function handleKeydown(event) {
  if ((event.code === 'Space' || event.code === 'Enter') && gameScreen.classList.contains('is-active')) {
    event.preventDefault();
    stopRound(false);
  }
}

startButton.addEventListener('click', startGame);
retryButton.addEventListener('click', startGame);
copyButton.addEventListener('click', copyResult);
stopButton.addEventListener('click', () => stopRound(false));
document.addEventListener('keydown', handleKeydown);

resetState();
