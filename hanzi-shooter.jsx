import { useState, useEffect, useRef } from "react";

// ---------- config ----------

const DIFFICULTY_ORDER = ["easy", "medium", "hard"];
const DIFFICULTY = {
  easy: { label: "Easy", fallMs: 9000 },
  medium: { label: "Medium", fallMs: 6000 },
  hard: { label: "Hard", fallMs: 3800 },
};

const MAX_LIVES = 3;
const BONUS_EVERY = 10;
const MAX_ACTIVE = 3;
const LANE_LEFT_PCT = [18, 50, 82];

const DEFAULT_WORDS = [
  { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "hello" },
  { hanzi: "谢谢", pinyin: "xiè xiè", meaning: "thank you" },
  { hanzi: "再见", pinyin: "zài jiàn", meaning: "goodbye" },
  { hanzi: "老师", pinyin: "lǎo shī", meaning: "teacher" },
  { hanzi: "学生", pinyin: "xué shēng", meaning: "student" },
  { hanzi: "朋友", pinyin: "péng you", meaning: "friend" },
  { hanzi: "爸爸", pinyin: "bà ba", meaning: "dad" },
  { hanzi: "妈妈", pinyin: "mā ma", meaning: "mom" },
  { hanzi: "喜欢", pinyin: "xǐ huān", meaning: "like" },
  { hanzi: "吃饭", pinyin: "chī fàn", meaning: "eat" },
  { hanzi: "水", pinyin: "shuǐ", meaning: "water" },
  { hanzi: "猫", pinyin: "māo", meaning: "cat" },
  { hanzi: "狗", pinyin: "gǒu", meaning: "dog" },
  { hanzi: "书", pinyin: "shū", meaning: "book" },
  { hanzi: "学校", pinyin: "xué xiào", meaning: "school" },
  { hanzi: "今天", pinyin: "jīn tiān", meaning: "today" },
  { hanzi: "明天", pinyin: "míng tiān", meaning: "tomorrow" },
  { hanzi: "中国", pinyin: "Zhōng guó", meaning: "China" },
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
    .replace(/\s+/g, "")
    .toLowerCase();
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

  const [speedIndex, setSpeedIndex] = useState(0);
  const [activeWords, setActiveWords] = useState([]);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [failedWords, setFailedWords] = useState([]);
  const [bonusFlash, setBonusFlash] = useState(false);
  const [waveFlash, setWaveFlash] = useState(null);

  const masterListRef = useRef(masterList);
  const speedIndexRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const queueRef = useRef([]);
  const seqRef = useRef(0);
  const activeWordsRef = useRef([]);
  const gameOverRef = useRef(false);
  const lastSpawnRef = useRef(0);
  const rafRef = useRef(null);
  const inputRef = useRef(null);

  // ---- parse pasted list ----
  function parseImport(text) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const words = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        words.push({ hanzi: parts[0], pinyin: parts[1], meaning: parts[2] || "" });
      }
    }
    return words;
  }

  function handleStart() {
    let list = masterList;
    if (rawImport.trim()) {
      const parsed = parseImport(rawImport);
      if (parsed.length >= 5) list = parsed;
    }
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

    startWave(list);
    setScreen("playing");
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
    }, 450);
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
      setWaveFlash(`Speeding up — ${DIFFICULTY[DIFFICULTY_ORDER[nextIndex]].label} now!`);
      setTimeout(() => setWaveFlash(null), 1800);
      startWave(masterListRef.current);
    } else {
      setScreen("end");
    }
  }

  function handleHit(word) {
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

  function submitGuess() {
    if (!input.trim()) return;
    const falling = activeWordsRef.current.filter((w) => !w.state);
    if (falling.length === 0) return;

    let match = null;
    if (inputMode === "pinyin") {
      const guess = toToneless(input);
      if (guess.length === 0) return;
      match = falling
        .slice()
        .sort((a, b) => b.progress - a.progress)
        .find((w) => toToneless(w.data.pinyin) === guess);
    } else {
      const guess = input.trim();
      if (guess.length === 0) return;
      match = falling
        .slice()
        .sort((a, b) => b.progress - a.progress)
        .find((w) => w.data.hanzi === guess);
    }

    if (!match) return; // wrong guess: nothing happens, word keeps falling
    handleHit(match);
  }

  function handleInputKeyDown(e) {
    if (e.nativeEvent && e.nativeEvent.isComposing) return; // let IME finish
    if (e.key === "Enter") {
      e.preventDefault();
      submitGuess();
    } else if (e.key === " " && inputMode === "pinyin") {
      // space is reserved for IME candidate selection in character mode
      e.preventDefault();
      submitGuess();
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

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  useEffect(() => {
    if (screen === "playing" && inputRef.current) inputRef.current.focus();
  }, [screen]);

  // ---------- screens ----------

  if (screen === "start") {
    return (
      <div style={styles.page}>
        <div style={styles.startCard}>
          <h1 style={styles.title}>汉字 Shooter</h1>
          <p style={styles.subtitle}>Type the answer before the word lands.</p>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Guess by</div>
            <div style={styles.pillRow}>
              <button
                onClick={() => setInputMode("pinyin")}
                style={{ ...styles.pill, ...(inputMode === "pinyin" ? styles.pillActive : {}) }}
              >
                Pinyin
              </button>
              <button
                onClick={() => setInputMode("character")}
                style={{ ...styles.pill, ...(inputMode === "character" ? styles.pillActive : {}) }}
              >
                Character
              </button>
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>Difficulty</div>
            <div style={styles.pillRow}>
              {Object.entries(DIFFICULTY).map(([key, d]) => (
                <button
                  key={key}
                  onClick={() => setDifficulty(key)}
                  style={{
                    ...styles.pill,
                    ...(difficulty === key ? styles.pillActive : {}),
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={styles.sectionLabel}>
              Vocabulary ({masterList.length} words loaded — using sample set unless you paste your own)
            </div>
            <textarea
              placeholder={"Optional: paste your own list, one word per line\n汉字,pinyin,meaning\n你好,nǐ hǎo,hello"}
              value={rawImport}
              onChange={(e) => setRawImport(e.target.value)}
              style={styles.textarea}
              rows={5}
            />
          </div>

          <button style={styles.primaryBtn} onClick={handleStart}>
            Start game
          </button>
        </div>
      </div>
    );
  }

  if (screen === "end") {
    const won = lives > 0;
    return (
      <div style={styles.page}>
        <div style={styles.startCard}>
          <h1 style={styles.title}>{won ? "All levels cleared!" : "Game over"}</h1>
          <p style={styles.subtitle}>
            Score: {score} &nbsp;·&nbsp; Missed: {failedWords.length}
          </p>

          {failedWords.length > 0 ? (
            <div style={styles.section}>
              <div style={styles.sectionLabel}>Words to review</div>
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
            <p style={{ color: "#8fd8a0", marginTop: 8 }}>Perfect run — no misses.</p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <button style={styles.primaryBtn} onClick={() => retry("all")}>
              Practice full list
            </button>
            {failedWords.length > 0 && (
              <button style={styles.secondaryBtn} onClick={() => retry("failed")}>
                Practice failed only
              </button>
            )}
            <button style={styles.ghostBtn} onClick={() => setScreen("start")}>
              Back to menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- playing screen ----
  return (
    <div style={styles.page}>
      <style>{`
        @keyframes soldierBob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>

      <div style={styles.hud}>
        <div style={styles.livesRow}>
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <span key={i} style={{ opacity: i < lives ? 1 : 0.25, fontSize: 20 }}>
              ❤
            </span>
          ))}
        </div>
        <div style={styles.scoreText}>Score {score}</div>
        <div style={styles.diffText}>{DIFFICULTY[DIFFICULTY_ORDER[speedIndex]].label}</div>
      </div>

      {bonusFlash && <div style={styles.bonusFlash}>+1 life — bonus word!</div>}
      {waveFlash && <div style={styles.waveFlash}>{waveFlash}</div>}

      <div style={styles.arena}>
        {activeWords.map((w) => {
          const topPx = 20 + w.progress * 300;
          const leftPct = LANE_LEFT_PCT[w.lane];
          const isBonus = w.seq % BONUS_EVERY === 0;
          return (
            <div
              key={w.id}
              style={{
                ...styles.fallingWord,
                top: `${topPx}px`,
                left: `${leftPct}%`,
                ...(w.state === "hit" ? styles.hitWord : {}),
                ...(w.state === "miss" ? styles.missWord : {}),
              }}
            >
              {isBonus && <div style={styles.bonusTag}>bonus</div>}
              {inputMode === "pinyin" ? (
                <>
                  <div style={styles.hanziText}>{w.data.hanzi}</div>
                  {w.data.meaning && <div style={styles.meaningText}>{w.data.meaning}</div>}
                </>
              ) : (
                <>
                  <div style={styles.pinyinPrompt}>{w.data.pinyin}</div>
                  {w.data.meaning && <div style={styles.meaningText}>{w.data.meaning}</div>}
                </>
              )}
            </div>
          );
        })}
        <div style={styles.groundLine} />
        <div style={styles.soldier}>
          <img src="luffy.jpg" alt="soldier" style={styles.soldierImg} />
        </div>
      </div>

      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleInputKeyDown}
        placeholder={
          inputMode === "pinyin" ? "type pinyin, then Enter/Space" : "type the character, then Enter"
        }
        style={styles.textInput}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

// ---------- styles ----------

const styles = {
  page: {
    minHeight: "600px",
    background: "linear-gradient(180deg, #10131f 0%, #171b2c 100%)",
    color: "#eef0f6",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "28px 16px",
    boxSizing: "border-box",
  },
  startCard: {
    width: "100%",
    maxWidth: 440,
    background: "#1b2036",
    border: "1px solid #2c3352",
    borderRadius: 14,
    padding: 26,
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 4px 0",
    fontSize: 30,
    fontWeight: 700,
    color: "#ffd166",
    letterSpacing: 0.5,
  },
  subtitle: { margin: "0 0 20px 0", color: "#9aa2c0", fontSize: 14 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 12.5, color: "#7c85ab", marginBottom: 8 },
  pillRow: { display: "flex", gap: 8 },
  pill: {
    flex: 1,
    padding: "9px 0",
    borderRadius: 8,
    border: "1px solid #343c60",
    background: "#232945",
    color: "#c7cce4",
    fontSize: 14,
    cursor: "pointer",
  },
  pillActive: {
    background: "#ffd166",
    color: "#1b2036",
    border: "1px solid #ffd166",
    fontWeight: 600,
  },
  textarea: {
    width: "100%",
    background: "#12162a",
    border: "1px solid #343c60",
    borderRadius: 8,
    color: "#dfe2f2",
    fontSize: 13,
    padding: 10,
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
  },
  primaryBtn: {
    width: "100%",
    padding: "13px 0",
    borderRadius: 9,
    border: "none",
    background: "#ff6b6b",
    color: "#1b2036",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "11px 16px",
    borderRadius: 9,
    border: "1px solid #343c60",
    background: "#232945",
    color: "#eef0f6",
    fontSize: 14,
    cursor: "pointer",
  },
  ghostBtn: {
    padding: "11px 16px",
    borderRadius: 9,
    border: "1px solid transparent",
    background: "transparent",
    color: "#7c85ab",
    fontSize: 14,
    cursor: "pointer",
  },
  failedList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 220,
    overflowY: "auto",
  },
  failedRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    background: "#12162a",
    padding: "8px 10px",
    borderRadius: 7,
  },
  failedHanzi: { fontSize: 17, color: "#ffd166", minWidth: 44 },
  failedPinyin: { fontSize: 13, color: "#9aa2c0", minWidth: 70 },
  failedMeaning: { fontSize: 12.5, color: "#6d759a" },

  hud: {
    width: "100%",
    maxWidth: 480,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  livesRow: { display: "flex", gap: 4 },
  scoreText: { fontSize: 14, color: "#c7cce4" },
  diffText: { fontSize: 12, color: "#7c85ab", textTransform: "uppercase", letterSpacing: 1 },

  bonusFlash: {
    position: "absolute",
    top: 70,
    background: "#ffd166",
    color: "#1b2036",
    fontWeight: 700,
    fontSize: 13,
    padding: "6px 14px",
    borderRadius: 20,
    zIndex: 5,
  },
  waveFlash: {
    position: "absolute",
    top: 70,
    background: "#8fd8a0",
    color: "#1b2036",
    fontWeight: 700,
    fontSize: 13,
    padding: "6px 14px",
    borderRadius: 20,
    zIndex: 5,
  },

  arena: {
    position: "relative",
    width: "100%",
    maxWidth: 480,
    height: 360,
    background: "#12162a",
    border: "1px solid #2c3352",
    borderRadius: 12,
    overflow: "hidden",
  },
  bonusTag: {
    position: "absolute",
    top: -16,
    left: "50%",
    transform: "translateX(-50%)",
    fontSize: 10,
    color: "#1b2036",
    background: "#8fd8a0",
    padding: "2px 6px",
    borderRadius: 6,
    fontWeight: 700,
    whiteSpace: "nowrap",
    zIndex: 4,
  },
  fallingWord: {
    position: "absolute",
    transform: "translateX(-50%)",
    textAlign: "center",
  },
  hanziText: {
    fontSize: 40,
    fontWeight: 600,
    color: "#eef0f6",
    textShadow: "0 0 14px rgba(255,209,102,0.25)",
  },
  pinyinPrompt: {
    fontSize: 22,
    fontWeight: 600,
    color: "#eef0f6",
    textShadow: "0 0 14px rgba(255,209,102,0.25)",
  },
  meaningText: { fontSize: 11, color: "#7c85ab", marginTop: 2 },
  hitWord: { color: "#8fd8a0", transform: "translateX(-50%) scale(1.15)" },
  missWord: { color: "#ff6b6b" },
  groundLine: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    height: 1,
    background: "#2c3352",
  },
  soldier: {
    position: "absolute",
    bottom: 14,
    left: "50%",
    transform: "translateX(-50%)",
  },
  soldierImg: {
    width: 50,
    height: 50,
    objectFit: "cover",
    borderRadius: 8,
    animation: "soldierBob 1.6s ease-in-out infinite",
  },

  textInput: {
    width: "100%",
    maxWidth: 480,
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 9,
    border: "1px solid #343c60",
    background: "#1b2036",
    color: "#eef0f6",
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
  },
};
