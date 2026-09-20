# 汉字 Shooter

A browser game for practising Chinese vocabulary. Words fall from the sky, and you type the answer before they land on your ship.

**Play it: https://yho02.github.io/hanzi-shooter/**

## How to play

1. **Pick a guessing mode**
   - **Pinyin**: you see the character and its meaning, type the sound. Tone marks are not needed (`nihao` matches `nǐhǎo`).
   - **Character**: you see the pinyin and meaning, and you type the hanzi with your IME.
2. **Pick a difficulty**: Easy, Medium or Hard. This sets how fast the words fall.
3. **Pick a word list**
   - **Basic**: a small sample set to try the game.
   - **HSK 1–6 and HSK 7–9**: the real HSK 3.0 vocabulary. Each level is split into parts of 20 words, and you choose which part to play. This keeps the big levels (HSK 7–9 has about 4,500 words) playable.
   - **Your own charts**: paste your own words instead. One hanzi word per line and the pinyin and meaning are filled in from the HSK list, or give them yourself as `汉字,pinyin,meaning`.
4. **Set sail.**

### Rules

- You have **3 lives**. A word that reaches your ship costs one life.
- Words keep falling until you type them correctly or they land. A wrong guess costs nothing, so keep guessing.
- Every **10th word** you get right gives back one life (never more than 3).
- Clear the whole list and the words speed up to the next difficulty. Clear it on Hard and you win.
- When the game ends you see the words you missed, and you can practise the full list again or only the missed words.

## Run it locally

You need [Node.js](https://nodejs.org/).

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173/hanzi-shooter/).

## Deploy

The site is a static Vite build hosted on GitHub Pages.

```bash
npm run build
```

Push the contents of `dist/` to the `gh-pages` branch. The `base` path in [vite.config.js](vite.config.js) must match the repo name.

## Project layout

| File | What it does |
| --- | --- |
| [hanzi-shooter.jsx](hanzi-shooter.jsx) | Game logic and screens |
| [map-art.jsx](map-art.jsx) | Hand-drawn map-style UI and artwork |
| [hsk-dictionary.js](hsk-dictionary.js) | Loads the HSK CSVs, one level at a time, and splits them into parts |
| [public/hsk_vocab/](public/hsk_vocab/) | HSK 3.0 vocabulary CSVs (`level,word,pinyin,english`) |

Only the level you choose is downloaded. Edit a CSV and refresh to change the word list, with no code change.

## Vocabulary data and credits

The HSK 3.0 word list, levels and pinyin come from the official HSK 3.0 Examination Syllabus published by CTI (Chinese Test International) / Hanban at https://www.chinesetest.cn/hsk. English translations come from [drkameleon/complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) (MIT), which is itself compiled from CC-CEDICT and other open sources.

The CSVs were extracted and merged into one dataset, published separately as **[HSK-3.0-Vocabulary-List](https://github.com/yho02/HSK-3.0-Vocabulary-List)**. See that repo for the column definitions, sources and licence notes.

Translations are not proofread by a human, so treat them as a study aid and not a dictionary. This project is unofficial and is not affiliated with or endorsed by CTI or Hanban.

## Licence

The game code is released under the [MIT License](LICENSE). The vocabulary data has its own terms, described above.
