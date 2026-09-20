import { useState, useEffect, useRef } from "react";
import {
  MAP,
  FONT_TITLE,
  FONT_BRUSH,
  FONT_TEXT,
  MapSheet,
  DifficultyMap,
  Compass,
  JollyRoger,
  SectionTitle,
  ChoiceChip,
  InkButton,
  WaxSeal,
  LevelBackdrop,
  LEVEL_NAMES,
  LEVEL_SEA,
  Ship,
  Heart,
  ArrowShot,
  Burst,
  FrontWave,
} from "./map-art.jsx";
import { HSK_LEVELS, loadDictionary, loadLevel, splitIntoParts } from "./hsk-dictionary.js";

// ---------- config ----------
const DIFFICULTY_ORDER = ["easy", "medium", "hard"];
const DIFFICULTY = {
  easy: { label: LEVEL_NAMES[0], fallMs: 9000 },
  medium: { label: LEVEL_NAMES[1], fallMs: 7000 },
  hard: { label: LEVEL_NAMES[2], fallMs: 4800 },
};

const MAX_LIVES = 3;
const BONUS_EVERY = 10;
const MAX_ACTIVE = 3;
const MIN_IMPORT_WORDS = 5;
const PART_SIZE = 20; // words per part when playing an HSK level
const LANE_LEFT_PCT = [18, 50, 82];

// A falling word sits at: top = WORD_TOP_PAD + progress * (arena height - WORD_TRAVEL_GAP).
// The gap leaves room for the boat, so a word "lands" right above it on any screen size.
const WORD_TOP_PAD = 4;
const WORD_TRAVEL_GAP = 250;
const WORD_HALF_HEIGHT = 42;
const ARROW_FROM_BOTTOM = 96;

const DEFAULT_WORDS = [
  { hanzi: "你好", pinyin: "nǐhǎo", meaning: "hello" },
  { hanzi: "谢谢", pinyin: "xièxiè", meaning: "thank you" },
  { hanzi: "再见", pinyin: "zàijiàn", meaning: "goodbye" },
  { hanzi: "老师", pinyin: "lǎoshī", meaning: "teacher" },
  { hanzi: "学生", pinyin: "xuéshēng", meaning: "student" },
  { hanzi: "朋友", pinyin: "péngyou", meaning: "friend" },
  { hanzi: "爸爸", pinyin: "bàba", meaning: "dad" },
  { hanzi: "妈妈", pinyin: "māma", meaning: "mom" },
  { hanzi: "喜欢", pinyin: "xǐhuān", meaning: "like" },
  { hanzi: "吃饭", pinyin: "chīfàn", meaning: "eat" },
  { hanzi: "水", pinyin: "shuǐ", meaning: "water" },
  { hanzi: "猫", pinyin: "māo", meaning: "cat" },
  { hanzi: "狗", pinyin: "gǒu", meaning: "dog" },
  { hanzi: "书", pinyin: "shū", meaning: "book" },
  { hanzi: "学校", pinyin: "xuéxiào", meaning: "school" },
  { hanzi: "今天", pinyin: "jīntiān", meaning: "today" },
  { hanzi: "明天", pinyin: "míngtiān", meaning: "tomorrow" },
  { hanzi: "中国", pinyin: "Zhōngguó", meaning: "China" },
];

// ---------- helpers ----------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toToneless(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s'’]+/g, "") // HSK pinyin writes syllable breaks like xīn’ài
    .toLowerCase();
}
function isPinyinPrefix(typed, fullPinyin) {
  const guess = toToneless(typed);
  return guess.length > 0 && toToneless(fullPinyin).startsWith(guess);
}
function speak(hanzi) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(hanzi);
    utter.lang = "zh-CN";
    window.speechSynthesis.speak(utter);
  } catch {
    // speech synthesis not available — fail silently
  }
}

let uidCounter = 0;
function nextId() {
  uidCounter += 1;
  return uidCounter;
}

// ---------- component ----------

export default function HanziShooter() {
  const [screen, setScreen] = useState("start"); // start | playing | end
  const [difficulty, setDifficulty] = useState("medium");
  const [inputMode, setInputMode] = useState("pinyin"); // "pinyin" | "character"
  const [rawImport, setRawImport] = useState("");
  const [masterList, setMasterList] = useState(DEFAULT_WORDS);
  const [dictStatus, setDictStatus] = useState("loading"); // loading | ready | error
  const [starting, setStarting] = useState(false); // waiting on the dictionary after pressing start
  const [importNotice, setImportNotice] = useState("");
  const [warnedImport, setWarnedImport] = useState(""); // pasted text we already warned about missing words
  const [hskLevel, setHskLevel] = useState(null); // null = sample words, otherwise a key from HSK_LEVELS
  const [levelParts, setLevelParts] = useState([]); // the chosen level cut into parts of PART_SIZE words
  const [levelStatus, setLevelStatus] = useState("idle"); // idle | loading | ready | error
  const [partIndex, setPartIndex] = useState(0);

  const [speedIndex, setSpeedIndex] = useState(0);
  const [activeWords, setActiveWords] = useState([]);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [failedWords, setFailedWords] = useState([]);
  const [bonusFlash, setBonusFlash] = useState(false);
  const [waveFlash, setWaveFlash] = useState(null);
  const [arrows, setArrows] = useState([]);
  const [paused, setPaused] = useState(false);

  const masterListRef = useRef(masterList);
  const speedIndexRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const queueRef = useRef([]);
  const seqRef = useRef(0);
  const activeWordsRef = useRef([]);
  const gameOverRef = useRef(false);
  const pausedAtRef = useRef(null); // performance.now() when the game was paused, null while running
  const lastSpawnRef = useRef(0);
  const rafRef = useRef(null);
  const inputRef = useRef(null);
  const arenaRef = useRef(null);
  const boatRef = useRef(null);
  const boatPosRef = useRef(50); // where the boat sits (lane %), it only changes when a word matches

  // Start downloading the HSK dictionary right away, so it is usually ready by the time the user presses start.
  useEffect(() => {
    loadDictionary().then(
      () => setDictStatus("ready"),
      () => setDictStatus("error")
    );
  }, []);

  // Download the chosen HSK level (cached after the first time) and cut it into parts.
  useEffect(() => {
    if (!hskLevel) {
      setLevelStatus("idle");
      return;
    }
    let cancelled = false; // ignore the result if the user already picked another level
    setLevelStatus("loading");
    setLevelParts([]);
    setPartIndex(0);
    loadLevel(hskLevel).then(
      (words) => {
        if (cancelled) return;
        setLevelParts(splitIntoParts(words, PART_SIZE, MIN_IMPORT_WORDS));
        setLevelStatus("ready");
      },
      () => {
        if (!cancelled) setLevelStatus("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [hskLevel]);

  // ---- parse pasted list ----
  // A line with commas is "hanzi,pinyin,meaning". A line without commas is hanzi only
  // (one or more words split by spaces or Chinese punctuation), and the dictionary fills in the rest.
  function parseImport(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items = [];
    const seen = new Set();
    function add(item) {
      if (seen.has(item.hanzi)) return;
      seen.add(item.hanzi);
      items.push(item);
    }
    for (const line of lines) {
      if (line.includes(",")) {
        const parts = line.split(",").map((p) => p.trim());
        if (parts[0] && parts[1]) add({ hanzi: parts[0], pinyin: parts[1], meaning: parts.slice(2).join(", ") });
      } else {
        line.split(/[\s、，,；;]+/).filter(Boolean).forEach((hanzi) => add({ hanzi }));
      }
    }
    return items;
  }

  async function handleStart() {
    if (starting) return;
    let list = masterList;

    if (rawImport.trim()) {
      const items = parseImport(rawImport);
      let resolved = items;

      if (items.some((it) => !it.pinyin)) {
        setStarting(true);
        try {
          const dict = await loadDictionary();
          resolved = items.map((it) => (it.pinyin ? it : dict.get(it.hanzi) || it));
        } catch {
          setStarting(false);
          setImportNotice("Could not load the HSK dictionary. Check your connection, or paste hanzi,pinyin,meaning lines.");
          return;
        }
        setStarting(false);
      }

      const found = resolved.filter((it) => it.pinyin);
      const missing = resolved.filter((it) => !it.pinyin).map((it) => it.hanzi);

      if (missing.length > 0 && warnedImport !== rawImport) {
        // Warn once. Pressing start again with the same text plays without the missing words.
        setWarnedImport(rawImport);
        setImportNotice(`Not in the HSK list: ${missing.join("、")}. Press start again to play without them.`);
        return;
      }
      if (found.length < MIN_IMPORT_WORDS) {
        setImportNotice(`Need at least ${MIN_IMPORT_WORDS} words to start (found ${found.length}).`);
        return;
      }
      list = found;
    } else if (hskLevel) {
      if (levelStatus !== "ready" || !levelParts[partIndex]) {
        setImportNotice(
          levelStatus === "error"
            ? "Could not load this HSK level. Check your connection and pick the level again."
            : "The HSK level is still loading."
        );
        return;
      }
      list = levelParts[partIndex];
    }

    setImportNotice("");
    setMasterList(list);
    beginRun(list);
  }

  function startWave(list) {
    queueRef.current = shuffle(list);
    lastSpawnRef.current = -Infinity; // guarantee the first word spawns immediately
  }

  function beginRun(list) {
    masterListRef.current = list;
    livesRef.current = MAX_LIVES;
    seqRef.current = 0;
    gameOverRef.current = false;
    pausedAtRef.current = null;
    activeWordsRef.current = [];

    const startIdx = DIFFICULTY_ORDER.indexOf(difficulty);
    speedIndexRef.current = startIdx;

    setSpeedIndex(startIdx);
    setLives(MAX_LIVES);
    setScore(0);
    setFailedWords([]);
    setInput("");
    setActiveWords([]);
    setBonusFlash(false);
    setWaveFlash(null);
    setArrows([]);
    setPaused(false);
    boatPosRef.current = 50;

    startWave(list);
    setScreen("playing");
  }

  function pauseGame() {
    if (pausedAtRef.current !== null || gameOverRef.current) return;
    pausedAtRef.current = performance.now();
    setPaused(true);
  }

  function resumeGame() {
    if (pausedAtRef.current === null) return;
    // push every timer forward by the time spent paused, so words resume exactly where they stopped
    const pausedFor = performance.now() - pausedAtRef.current;
    pausedAtRef.current = null;
    for (const w of activeWordsRef.current) w.spawnTime += pausedFor;
    lastSpawnRef.current += pausedFor;
    setPaused(false);
  }

  function quitGame() {
    gameOverRef.current = true; // stops any pending word timers from advancing this run
    pausedAtRef.current = null;
    activeWordsRef.current = [];
    queueRef.current = [];
    setPaused(false);
    setActiveWords([]);
    setInput("");
    setScreen("start");
  }

  function retry(mode) {
    const list = mode === "failed" ? failedWords : masterList;
    if (list.length === 0) return;
    beginRun(list);
  }

  function pickFreeLane() {
    const used = new Set(activeWordsRef.current.map((w) => w.lane));
    for (let i = 0; i < LANE_LEFT_PCT.length; i++) {
      if (!used.has(i)) return i;
    }
    return 0;
  }

  function decrementLife() {
    livesRef.current = Math.max(0, livesRef.current - 1);
    setLives(livesRef.current);
    return livesRef.current;
  }

  function scheduleRemoval(id) {
    setTimeout(() => {
      activeWordsRef.current = activeWordsRef.current.filter((w) => w.id !== id);
      setActiveWords([...activeWordsRef.current]);
      maybeHandleListCleared();
    }, 1200);
  }

  function maybeHandleListCleared() {
    if (gameOverRef.current) return;
    if (activeWordsRef.current.length === 0 && queueRef.current.length === 0) {
      handleListCleared();
    }
  }

  function handleListCleared() {
    if (speedIndexRef.current < DIFFICULTY_ORDER.length - 1) {
      const nextIndex = speedIndexRef.current + 1;
      speedIndexRef.current = nextIndex;
      setSpeedIndex(nextIndex);
      setWaveFlash(`Speeding up — ${LEVEL_NAMES[nextIndex]}!`);
      setTimeout(() => setWaveFlash(null), 1800);
      startWave(masterListRef.current);
    } else {
      setScreen("end");
    }
  }

  // Shoot an arrow from where the boat is now to the word that was just solved.
  function fireArrow(word) {
    const arena = arenaRef.current;
    if (!arena) return;
    const W = arena.clientWidth;
    const H = arena.clientHeight;
    // start from where the boat really is right now, even if it is still sliding
    const boat = boatRef.current;
    const boatMid = boat ? boat.getBoundingClientRect().left + boat.offsetWidth / 2 : 0;
    const x0 = boat ? boatMid - arena.getBoundingClientRect().left : W / 2;
    const y0 = H - ARROW_FROM_BOTTOM;
    const x1 = (LANE_LEFT_PCT[word.lane] / 100) * W;
    const y1 = Math.max(0, WORD_TOP_PAD + word.progress * (H - WORD_TRAVEL_GAP)) + WORD_HALF_HEIGHT;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const id = nextId();
    const arrow = { id, x0, y0, len: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
    setArrows((prev) => [...prev, arrow]);
    setTimeout(() => setArrows((prev) => prev.filter((a) => a.id !== id)), 900);
  }

  function handleHit(word) {
    fireArrow(word);
    setScore((s) => s + 1);
    setInput("");
    speak(word.data.hanzi);

    if (word.seq % BONUS_EVERY === 0) {
      if (livesRef.current < MAX_LIVES) {
        livesRef.current += 1;
        setLives(livesRef.current);
        setBonusFlash(true);
        setTimeout(() => setBonusFlash(false), 900);
      }
    }

    word.state = "hit";
    setActiveWords([...activeWordsRef.current]);
    scheduleRemoval(word.id);
  }

  function submitCharacterGuess() {
    if (!input.trim()) return;
    const falling = activeWordsRef.current.filter((w) => !w.state);
    if (falling.length === 0) return;

    const guess = input.trim();
    const match = falling
      .slice()
      .sort((a, b) => b.progress - a.progress)
      .find((w) => w.data.hanzi === guess);

    if (!match) {
      setInput("");
      return;
    }
    handleHit(match);
  }

  // Character mode: submit automatically as soon as the typed text equals a falling word.
  function checkCharacterGuess(val) {
    const guess = val.trim();
    if (!guess) return;
    const falling = activeWordsRef.current.filter((w) => !w.state);
    const exact = falling
      .slice()
      .sort((a, b) => b.progress - a.progress)
      .find((w) => w.data.hanzi === guess);
    if (exact) {
      handleHit(exact);
      return;
    }
    // no falling word starts with this text — wrong guess, clear it
    // (a partly committed multi-character word is kept so the user can finish it)
    if (!falling.some((w) => w.data.hanzi.startsWith(guess))) setInput("");
  }

  function handleInputChange(e) {
    if (pausedAtRef.current !== null) return;
    const val = e.target.value;
    setInput(val);
    if (inputMode === "character") {
      // while the IME is still composing, the box holds pinyin letters, not the chosen character
      if (!e.nativeEvent.isComposing) checkCharacterGuess(val);
      return;
    }
    if (!val.trim()) return;

    const falling = activeWordsRef.current.filter((w) => !w.state);
    const guess = toToneless(val);

    const exact = falling
      .slice()
      .sort((a, b) => b.progress - a.progress)
      .find((w) => toToneless(w.data.pinyin) === guess);
    if (exact) {
      handleHit(exact);
      return;
    }

    // typed pinyin no longer matches the start of any falling word — wrong guess, clear it
    const hasCandidate = falling.some((w) => isPinyinPrefix(val, w.data.pinyin));
    if (!hasCandidate) setInput("");
  }

  function handleInputKeyDown(e) {
    if (e.nativeEvent && e.nativeEvent.isComposing) return; // let IME finish
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputMode === "character") submitCharacterGuess();
    }
  }

  // ---- main game loop ----
  useEffect(() => {
    if (screen !== "playing") return;

    function loop(now) {
      const fallMs = DIFFICULTY[DIFFICULTY_ORDER[speedIndexRef.current]].fallMs;
      const spawnGap = fallMs / 3;

      while (
        activeWordsRef.current.length < MAX_ACTIVE &&
        queueRef.current.length > 0 &&
        now - lastSpawnRef.current >= spawnGap
      ) {
        const data = queueRef.current.shift();
        const seq = (seqRef.current += 1);
        const lane = pickFreeLane();
        activeWordsRef.current.push({
          id: nextId(),
          data,
          spawnTime: now,
          seq,
          lane,
          progress: 0,
          state: null,
        });
        lastSpawnRef.current = now;
      }

      const landed = [];
      for (const w of activeWordsRef.current) {
        if (w.state) continue;
        w.progress = Math.min(1, (now - w.spawnTime) / fallMs);
        if (w.progress >= 1) landed.push(w);
      }

      for (const w of landed) {
        w.state = "miss";
        setFailedWords((prev) =>
          prev.some((f) => f.hanzi === w.data.hanzi) ? prev : [...prev, w.data]
        );
        speak(w.data.hanzi);
        scheduleRemoval(w.id);
        const remaining = decrementLife();
        if (remaining <= 0) gameOverRef.current = true;
      }

      setActiveWords([...activeWordsRef.current]);

      if (gameOverRef.current) {
        setTimeout(() => setScreen("end"), 500);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    if (paused) return;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, paused]);

  useEffect(() => {
    if (screen === "playing" && !paused && inputRef.current) inputRef.current.focus();
  }, [screen, paused]);

  // Esc toggles pause. Switching to another tab pauses too, otherwise words would jump ahead on return.
  useEffect(() => {
    if (screen !== "playing") return;
    function onKeyDown(e) {
      if (e.key !== "Escape" || e.isComposing) return;
      if (pausedAtRef.current === null) pauseGame();
      else resumeGame();
    }
    function onVisibility() {
      if (document.hidden) pauseGame();
    }
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [screen]);

  // ---------- screens ----------

  const wordListNote =
    hskLevel === null
      ? `${DEFAULT_WORDS.length} sample words. Pick an HSK level to play its real vocabulary.`
      : levelStatus === "loading"
      ? "Loading the word list…"
      : levelStatus === "ready"
      ? `${levelParts.reduce((n, p) => n + p.length, 0)} words in this level, played ${PART_SIZE} at a time.`
      : "";

  if (screen === "start") {
    return (
      <div style={styles.pageFull}>
        <MapSheet>
          <div style={styles.mapHeader}>
            <JollyRoger size={96} />
            <div>
              <h1 style={styles.mapTitle}>
                <span style={styles.mapTitleHanzi}>汉字</span>Shooter
              </h1>
              <p style={styles.mapSubtitle}>Type the answer before the word lands.</p>
            </div>
            <div style={styles.mapCompass}>
              <Compass size={132} />
            </div>
          </div>

          <DifficultyMap
            options={Object.entries(DIFFICULTY).map(([key, d]) => ({ key, label: d.label }))}
            value={difficulty}
            onChange={setDifficulty}
          />

          <div style={styles.mapBottom}>
            <div>
              <SectionTitle>Guess by</SectionTitle>
              <div style={styles.chipRow}>
                <ChoiceChip active={inputMode === "pinyin"} onClick={() => setInputMode("pinyin")} sub="type the sound">
                  Pinyin
                </ChoiceChip>
                <ChoiceChip active={inputMode === "character"} onClick={() => setInputMode("character")} sub="type the hanzi">
                  Character
                </ChoiceChip>
              </div>
            </div>

            <div>
              <SectionTitle note={wordListNote}>Word list</SectionTitle>
              <div style={styles.chipRow}>
                <ChoiceChip active={hskLevel === null} onClick={() => setHskLevel(null)} sub="sample">
                  Basic
                </ChoiceChip>
                {HSK_LEVELS.map((lvl) => (
                  <ChoiceChip key={lvl.key} active={hskLevel === lvl.key} onClick={() => setHskLevel(lvl.key)}>
                    {lvl.label}
                  </ChoiceChip>
                ))}
              </div>
              {hskLevel && levelStatus === "ready" && (
                <select
                  value={partIndex}
                  onChange={(e) => setPartIndex(Number(e.target.value))}
                  style={styles.partSelect}
                  aria-label="Choose a part of this level"
                >
                  {levelParts.map((part, i) => (
                    <option key={i} value={i}>
                      Part {i + 1} of {levelParts.length} · {part[0].hanzi} … {part[part.length - 1].hanzi} ({part.length} words)
                    </option>
                  ))}
                </select>
              )}
              {hskLevel && levelStatus === "error" && (
                <p style={styles.importNotice}>Could not load this level. Check your connection, then pick it again.</p>
              )}

              <div style={{ marginTop: 18 }}>
                <SectionTitle note="Optional. Pasted words are played instead of the list above.">
                  Your own charts
                </SectionTitle>
              </div>
              <textarea
                placeholder={"Optional: paste hanzi only, one word per line, and we add the pinyin and meaning\n你好\n谢谢\n\nOr give your own: 汉字,pinyin,meaning"}
                value={rawImport}
                onChange={(e) => {
                  setRawImport(e.target.value);
                  setImportNotice("");
                }}
                style={styles.mapTextarea}
                rows={4}
              />
              {(importNotice || starting || (dictStatus === "error" && rawImport.trim())) && (
                <p style={styles.importNotice}>
                  {starting
                    ? "Loading the HSK dictionary…"
                    : importNotice || "The HSK dictionary could not be loaded. Paste hanzi,pinyin,meaning lines instead."}
                </p>
              )}
            </div>

            <WaxSeal onClick={handleStart}>
              SET
              <br />
              SAIL
            </WaxSeal>
          </div>
        </MapSheet>
      </div>
    );
  }

  if (screen === "end") {
    const won = lives > 0;
    return (
      <div style={styles.pageFull}>
        <MapSheet contentWidth={860} center>
          <div style={styles.mapHeader}>
            <JollyRoger size={84} />
            <div>
              <h1 style={{ ...styles.mapTitle, fontSize: 56 }}>{won ? "All levels cleared!" : "Game over"}</h1>
              <p style={styles.mapSubtitle}>
                Score: {score} &nbsp;·&nbsp; Missed: {failedWords.length}
              </p>
            </div>
          </div>

          {failedWords.length > 0 ? (
            <div style={{ marginTop: 22 }}>
              <SectionTitle>Words to review</SectionTitle>
              <div style={styles.failedList}>
                {failedWords.map((w, i) => (
                  <div key={i} style={styles.failedRow}>
                    <span style={styles.failedHanzi}>{w.hanzi}</span>
                    <span style={styles.failedPinyin}>{w.pinyin}</span>
                    <span style={styles.failedMeaning}>{w.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: MAP.green, fontSize: 22, fontStyle: "italic", marginTop: 22 }}>
              Perfect run — no misses.
            </p>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
            <InkButton variant="primary" onClick={() => retry("all")}>
              Practice full list
            </InkButton>
            {failedWords.length > 0 && (
              <InkButton onClick={() => retry("failed")}>Practice failed only</InkButton>
            )}
            <InkButton variant="ghost" onClick={() => setScreen("start")}>
              Back to menu
            </InkButton>
          </div>
        </MapSheet>
      </div>
    );
  }

  // ---- playing screen ----

  // The boat slides toward the falling word that matches what has been typed so far.
  const typed = input.trim();
  const aimedAt = typed
    ? activeWords.filter(
      (w) =>
        !w.state &&
        (inputMode === "pinyin" ? isPinyinPrefix(input, w.data.pinyin) : w.data.hanzi.startsWith(typed))
    )
    : [];
  const target = aimedAt.reduce((best, w) => (!best || w.progress > best.progress ? w : best), null);
  if (target) boatPosRef.current = LANE_LEFT_PCT[target.lane];
  const boatPct = boatPosRef.current;
  const boatLean = ((boatPct - 50) / 32) * 5;

  return (
    <div style={styles.page}>
      <LevelBackdrop level={speedIndex} />

      <div style={styles.hud}>
        <div style={styles.livesRow}>
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <Heart key={i} size={30} filled={i < lives} />
          ))}
        </div>
        <div style={styles.scoreText}>Score {score}</div>
        <div style={styles.diffText}>{LEVEL_NAMES[speedIndex]}</div>
        <InkButton onClick={pauseGame} style={styles.pauseBtn} aria-label="Pause game">
          Pause
        </InkButton>
      </div>

      {bonusFlash && <div style={styles.bonusFlash}>+1 life — bonus word!</div>}
      {waveFlash && <div style={styles.waveFlash}>{waveFlash}</div>}

      <div ref={arenaRef} style={styles.arena}>
        {activeWords.map((w) => {
          const leftPct = LANE_LEFT_PCT[w.lane];
          const isBonus = w.seq % BONUS_EVERY === 0;
          const inputLen = toToneless(input).length;
          const cleanPinyin = w.data.pinyin.replace(/\s+/g, "");
          const typedPinyin = cleanPinyin.slice(0, inputLen);
          const hit = w.state === "hit";
          return (
            <div
              key={w.id}
              style={{
                ...styles.fallingWord,
                top: `calc(${WORD_TOP_PAD}px + ${w.progress} * (100% - ${WORD_TRAVEL_GAP}px))`,
                left: `${leftPct}%`,
                ...(hit ? styles.hitWord : {}),
              }}
            >
              {isBonus && <div style={styles.bonusTag}>bonus</div>}
              {hit && <Burst />}
              {hit && inputMode === "pinyin" && <div style={styles.typedEcho}>{w.data.pinyin}</div>}
              {!w.state && inputMode === "pinyin" && isPinyinPrefix(input, w.data.pinyin) && (
                <div style={styles.typedEcho}>{typedPinyin}</div>
              )}
              <div
                style={{
                  ...styles.wordCard,
                  ...(hit ? styles.wordCardHit : {}),
                  ...(w.state === "miss" ? styles.wordCardMiss : {}),
                }}
              >
                {inputMode === "pinyin" || hit ? (
                  <div style={styles.hanziText}>{w.data.hanzi}</div>
                ) : (
                  <div style={styles.pinyinPrompt}>{w.data.pinyin}</div>
                )}
                {w.data.meaning && <div style={styles.meaningText}>{w.data.meaning}</div>}
              </div>
            </div>
          );
        })}

        {arrows.map((a) => (
          <ArrowShot key={a.id} x0={a.x0} y0={a.y0} len={a.len} angle={a.angle} />
        ))}

        <div ref={boatRef} style={{ ...styles.boat, left: `${boatPct}%` }}>
          <div className="map-anim" style={{ transform: `rotate(${boatLean}deg)`, transition: "transform 1.5s ease-in-out" }}>
            <div className="map-anim" style={{ animation: "shipBob 3.2s ease-in-out infinite" }}>
              <Ship size={150} />
            </div>
          </div>
        </div>
        <FrontWave fill={LEVEL_SEA[speedIndex]} />
      </div>

      <input
        ref={inputRef}
        className="map-input"
        value={input}
        onChange={handleInputChange}
        onCompositionEnd={(e) => {
          if (inputMode === "character") checkCharacterGuess(e.target.value);
        }}
        onKeyDown={handleInputKeyDown}
        placeholder={
          inputMode === "pinyin" ? "type pinyin — matches as you type" : "type the character — submits as you type"
        }
        style={styles.textInput}
        autoComplete="off"
        spellCheck={false}
        disabled={paused}
      />

      {paused && (
        <div style={styles.pauseOverlay}>
          <div style={styles.pauseCard}>
            <h2 style={styles.pauseTitle}>Paused</h2>
            <p style={styles.pauseHint}>Score {score} · Press Esc to resume</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <InkButton variant="primary" onClick={resumeGame} autoFocus>
                Resume
              </InkButton>
              <InkButton onClick={quitGame}>Quit to menu</InkButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- styles ----------

const PAPER = "#e9d09a";
const SKETCHY = "16px 6px 14px 8px / 8px 14px 6px 16px";
const PAPER_BG =
  "radial-gradient(ellipse at 30% 20%, rgba(255,245,215,0.7), transparent 60%)," +
  "radial-gradient(circle at 85% 90%, rgba(140,80,30,0.25), transparent 40%)";

const OUTLINE = {
  WebkitTextStroke: "9px #fffaf0",
  paintOrder: "stroke fill",
  textShadow: "0 0 10px rgba(255,255,255,0.95), 0 0 24px rgba(255,236,170,0.9), 0 0 44px rgba(255,214,110,0.6)",
};
const OUTLINE_SOFT = {
  WebkitTextStroke: `4px ${MAP.cream}`,
  paintOrder: "stroke fill",
};

const styles = {
  pageFull: {
    position: "relative",
    zIndex: 0,
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    color: MAP.cream,
    fontFamily: FONT_TEXT,
  },
  page: {
    position: "relative",
    zIndex: 0,
    minHeight: "100vh",
    color: MAP.cream,
    fontFamily: FONT_TEXT,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "28px 16px",
    boxSizing: "border-box",
  },
  mapHeader: { position: "relative", display: "flex", alignItems: "center", gap: 22 },
  mapTitle: {
    margin: 0,
    fontFamily: FONT_TITLE,
    fontWeight: 400,
    fontSize: 78,
    lineHeight: 1,
    letterSpacing: 1,
    color: MAP.ink,
    textShadow: "1px 2px 0 rgba(255,240,200,0.7)",
  },
  mapTitleHanzi: { fontFamily: FONT_BRUSH, color: MAP.red, marginRight: 16 },
  mapSubtitle: { margin: "6px 0 0", fontFamily: FONT_TEXT, fontStyle: "italic", fontSize: 21, color: MAP.inkSoft },
  mapCompass: { position: "absolute", top: -14, right: -20 },
  mapBottom: {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: 44,
    alignItems: "end",
    marginTop: "auto",
    paddingTop: 22,
  },
  chipRow: { display: "flex", gap: 14, flexWrap: "wrap" },
  mapTextarea: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(246,234,208,0.4)",
    border: `2.5px solid ${MAP.ink}`,
    borderRadius: "14px 6px 12px 8px / 8px 12px 6px 14px",
    color: MAP.ink,
    fontFamily: FONT_TEXT,
    fontSize: 16,
    padding: "10px 14px",
    resize: "vertical",
  },
  partSelect: {
    marginTop: 12,
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(246,234,208,0.4)",
    border: `2.5px solid ${MAP.ink}`,
    borderRadius: "14px 6px 12px 8px / 8px 12px 6px 14px",
    color: MAP.ink,
    fontFamily: FONT_TEXT,
    fontSize: 17,
    padding: "8px 12px",
  },
  importNotice: {
    margin: "8px 2px 0",
    color: MAP.red,
    fontFamily: FONT_TEXT,
    fontSize: 15,
    fontStyle: "italic",
  },
  failedList: { display: "flex", flexDirection: "column", maxHeight: 300, overflowY: "auto" },
  failedRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 18,
    padding: "8px 4px",
    borderBottom: `1.5px dashed ${MAP.inkSoft}`,
  },
  failedHanzi: { fontFamily: FONT_BRUSH, fontSize: 30, color: MAP.red, minWidth: 90 },
  failedPinyin: { fontFamily: FONT_TEXT, fontSize: 20, minWidth: 120 },
  failedMeaning: { fontFamily: FONT_TEXT, fontStyle: "italic", fontSize: 17, color: MAP.inkSoft },

  // ---- playing screen ----
  hud: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 26px",
    marginBottom: 10,
    backgroundColor: PAPER,
    backgroundImage: PAPER_BG,
    border: `3px solid ${MAP.ink}`,
    borderRadius: SKETCHY,
    boxShadow: `3px 5px 0 ${MAP.ink}, inset 0 0 22px rgba(120,70,20,0.35)`,
    color: MAP.ink,
  },
  livesRow: { display: "flex", gap: 6 },
  scoreText: { fontFamily: FONT_TITLE, fontSize: 30, lineHeight: 1 },
  diffText: { fontFamily: FONT_TITLE, fontSize: 24, lineHeight: 1, color: MAP.red, letterSpacing: 1 },

  pauseBtn: { padding: "4px 14px", fontSize: 18 },
  pauseOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(20,12,4,0.55)",
  },
  pauseCard: {
    backgroundColor: PAPER,
    backgroundImage: PAPER_BG,
    border: `3px solid ${MAP.ink}`,
    borderRadius: SKETCHY,
    boxShadow: `4px 6px 0 ${MAP.ink}, inset 0 0 22px rgba(120,70,20,0.35)`,
    color: MAP.ink,
    padding: "26px 40px",
    textAlign: "center",
  },
  pauseTitle: { margin: 0, fontFamily: FONT_TITLE, fontSize: 48, lineHeight: 1 },
  pauseHint: { margin: "10px 0 20px", fontFamily: FONT_TEXT, fontSize: 17, color: MAP.inkSoft },

  bonusFlash: {
    position: "absolute",
    top: 84,
    left: "50%",
    transform: "translateX(-50%)",
    background: MAP.gold,
    color: MAP.ink,
    border: `2.5px solid ${MAP.ink}`,
    fontFamily: FONT_TITLE,
    fontSize: 24,
    padding: "6px 22px",
    borderRadius: SKETCHY,
    boxShadow: `3px 4px 0 ${MAP.ink}`,
    zIndex: 6,
  },
  waveFlash: {
    position: "absolute",
    top: 84,
    left: "50%",
    transform: "translateX(-50%)",
    background: MAP.red,
    color: MAP.cream,
    border: `2.5px solid ${MAP.ink}`,
    fontFamily: FONT_TITLE,
    fontSize: 24,
    padding: "6px 22px",
    borderRadius: SKETCHY,
    boxShadow: `3px 4px 0 ${MAP.ink}`,
    zIndex: 6,
  },

  arena: { position: "relative", width: "100%", flex: 1, minHeight: 420, overflow: "hidden" },
  fallingWord: { position: "absolute", transform: "translateX(-50%)", textAlign: "center" },
  // no box behind the word: dark ink with a cream outline so it reads over the line art
  wordCard: { position: "relative", color: "#2a1408" },
  wordCardHit: { animation: "hitTint 800ms 200ms both" },
  wordCardMiss: { animation: "missShake 500ms both", color: MAP.red },
  hitWord: { animation: "hitPop 800ms 200ms ease-in both" },
  hanziText: {
    fontFamily: FONT_BRUSH,
    fontSize: 54,
    lineHeight: 1.15,
    ...OUTLINE,
  },
  pinyinPrompt: {
    fontFamily: FONT_TITLE,
    fontSize: 38,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    ...OUTLINE,
  },
  meaningText: {
    fontFamily: FONT_TEXT,
    fontStyle: "italic",
    fontSize: 17,
    color: "#5b3a1e",
    maxWidth: 240,
    margin: "0 auto",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ...OUTLINE_SOFT,
  },
  typedEcho: {
    position: "absolute",
    top: -40,
    left: "50%",
    transform: "translateX(-50%)",
    fontFamily: FONT_TITLE,
    fontSize: 24,
    lineHeight: 1,
    color: MAP.red,
    backgroundColor: PAPER,
    border: `2.5px solid ${MAP.ink}`,
    boxShadow: `2px 3px 0 ${MAP.ink}`,
    padding: "3px 12px",
    borderRadius: "10px 4px 9px 5px / 5px 9px 4px 10px",
    whiteSpace: "nowrap",
    zIndex: 6,
  },
  bonusTag: {
    position: "absolute",
    top: 10,
    left: "100%",
    marginLeft: 12,
    transform: "rotate(5deg)",
    fontFamily: FONT_TITLE,
    fontSize: 17,
    lineHeight: 1,
    color: MAP.ink,
    background: MAP.gold,
    border: `2.5px solid ${MAP.ink}`,
    boxShadow: `2px 3px 0 ${MAP.ink}`,
    padding: "3px 12px",
    borderRadius: 8,
    whiteSpace: "nowrap",
    zIndex: 4,
  },
  boat: {
    position: "absolute",
    bottom: -6,
    transform: "translateX(-50%)",
    transition: "left 1.5s cubic-bezier(0.45, 0, 0.25, 1)",
    zIndex: 3,
    pointerEvents: "none",
  },

  textInput: {
    width: "100%",
    marginTop: 14,
    padding: "12px 22px",
    boxSizing: "border-box",
    backgroundColor: PAPER,
    backgroundImage: PAPER_BG,
    border: `3px solid ${MAP.ink}`,
    borderRadius: SKETCHY,
    boxShadow: `3px 5px 0 ${MAP.ink}, inset 0 0 22px rgba(120,70,20,0.3)`,
    color: MAP.ink,
    fontFamily: "'IM Fell English', 'Ma Shan Zheng', serif",
    fontSize: 24,
    outline: "none",
  },
};
