// HSK vocabulary: fetches the level CSVs from public/hsk_vocab/. Each file is fetched once and cached
// for the rest of the session. Two views of the same data:
//   loadLevel(key)     -> one level as an ordered list of { hanzi, pinyin, meaning } (for picking a level to play)
//   loadDictionary()   -> every level as a hanzi -> entry lookup (for filling in pasted words)

// HSK 7-9 is a single file, so it is one "level" here.
export const HSK_LEVELS = [
  { key: "1", label: "HSK 1", file: "hsk_vocab_level_1.csv" },
  { key: "2", label: "HSK 2", file: "hsk_vocab_level_2.csv" },
  { key: "3", label: "HSK 3", file: "hsk_vocab_level_3.csv" },
  { key: "4", label: "HSK 4", file: "hsk_vocab_level_4.csv" },
  { key: "5", label: "HSK 5", file: "hsk_vocab_level_5.csv" },
  { key: "6", label: "HSK 6", file: "hsk_vocab_level_6.csv" },
  { key: "7-9", label: "HSK 7–9", file: "hsk_vocab_level_7-9.csv" },
];

// Columns are level,word,pinyin,english. The english column can itself contain commas
// (inside quotes), so only the first 3 commas are treated as separators.
function parseCsvLine(line) {
  const first = line.indexOf(",");
  const second = line.indexOf(",", first + 1);
  const third = line.indexOf(",", second + 1);
  if (first < 0 || second < 0 || third < 0) return null;

  let meaning = line.slice(third + 1).trim();
  if (meaning.startsWith('"') && meaning.endsWith('"')) {
    meaning = meaning.slice(1, -1).replace(/""/g, '"');
  }
  return {
    hanzi: line.slice(first + 1, second).trim(),
    pinyin: line.slice(second + 1, third).trim(),
    meaning,
  };
}

// Parses one CSV into a list of entries (header row skipped). Repeated hanzi keep the first row,
// because the game matches by hanzi and two falling words with the same hanzi would be ambiguous.
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const seen = new Set();
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    // i = 0 is the header row
    const entry = parseCsvLine(lines[i]);
    if (entry && entry.hanzi && !seen.has(entry.hanzi)) {
      seen.add(entry.hanzi);
      entries.push(entry);
    }
  }
  return entries;
}

// Cuts a long list into parts of `size` words. A tiny leftover is merged into the previous part,
// so no part is too short to play.
export function splitIntoParts(words, size, minLast) {
  const parts = [];
  for (let i = 0; i < words.length; i += size) parts.push(words.slice(i, i + size));
  if (parts.length > 1 && parts[parts.length - 1].length < minLast) {
    const last = parts.pop();
    parts[parts.length - 1] = parts[parts.length - 1].concat(last);
  }
  return parts;
}

const levelPromises = new Map();

// Safe to call many times: the download starts on the first call, later calls share the same promise.
// If the download fails, the cache entry is cleared so the next call can retry.
export function loadLevel(key) {
  if (!levelPromises.has(key)) {
    const level = HSK_LEVELS.find((l) => l.key === key);
    if (!level) return Promise.reject(new Error(`Unknown HSK level: ${key}`));
    const url = import.meta.env.BASE_URL + "hsk_vocab/" + level.file;
    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${level.file}: HTTP ${res.status}`);
        return res.text();
      })
      .then(parseCsv)
      .catch((err) => {
        levelPromises.delete(key);
        throw err;
      });
    levelPromises.set(key, promise);
  }
  return levelPromises.get(key);
}

export function loadDictionary() {
  return Promise.all(HSK_LEVELS.map((l) => loadLevel(l.key))).then((levels) => {
    const map = new Map();
    // A word can appear in several levels with different pinyin. The lowest level wins.
    for (const entries of levels) {
      for (const entry of entries) if (!map.has(entry.hanzi)) map.set(entry.hanzi, entry);
    }
    return map;
  });
}
