#!/usr/bin/env python3
"""
Parse the official HSK 3.0 vocabulary syllabus PDF into clean, per-level
CSV/JSON word lists WITH English translations.

Source PDF (official, free): CTI / Chinese Test International
https://www.chinesetest.cn/hsk  -> "Examination Syllabus" link, currently:
https://hsk.cn-bj.ufileos.com/3.0/新版HSK考试大纲1219.pdf

Translation source (community-maintained, not official, covers most but
not all words):
https://github.com/drkameleon/complete-hsk-vocabulary
https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/wordlists/inclusive/newest/7.json

Usage:
    pip install pdfplumber requests
    python parse_hsk_vocab_v2.py path/to/syllabus.pdf

Output (in ./hsk_vocab_output/):
    hsk_vocab_all.csv                  -- level, word, pinyin, english (all levels)
    hsk_vocab_all.json                 -- same data as JSON
    hsk_vocab_level_<N>.csv            -- split by level (1-6, 7-9)
    hsk_vocab_missing_translations.csv -- level, word, pinyin for words with
                                           NO match in the translation file,
                                           so you can fill these in by hand
"""

import re
import sys
import csv
import json
import unicodedata
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("Install pdfplumber first: pip install pdfplumber")

try:
    import requests
except ImportError:
    sys.exit("Install requests first: pip install requests")


TRANSLATION_URL = (
    "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/"
    "main/wordlists/inclusive/newest/7.json"
)


# --------------------------------------------------------------------------
# 1. Extract raw text from the PDF
# --------------------------------------------------------------------------
def extract_full_text(pdf_path: str) -> str:
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            t = page.extract_text() or ""
            text_parts.append(t)
    return "\n".join(text_parts)


def isolate_vocab_section(full_text: str) -> str:
    """Trim to just the 词汇大纲 (vocabulary) section, before 汉字大纲."""
    start_marker = "词汇大纲"
    end_marker = "汉字大纲"
    start = full_text.find(start_marker)
    end = full_text.find(end_marker, start if start != -1 else 0)
    if start == -1:
        return full_text
    if end == -1:
        return full_text[start:]
    return full_text[start:end]


# --------------------------------------------------------------------------
# 2. Strip the "汉考国际" watermark and repeated page headers
# --------------------------------------------------------------------------
def sanitize_watermark(text: str) -> str:
    """
    The PDF has a diagonal "汉考国际" (CTI, the test publisher) watermark on
    every page, which text-extraction picks up as regular text mixed into
    the vocab table -- usually landing wherever a page break falls, most
    often inside the part-of-speech field.

    We remove it in two passes so we don't accidentally eat a legitimate
    word like 国际 (guójì, "international"), which happens to reuse two of
    the same characters:
      1. Remove the literal 4-character phrase "汉考国际", repeated any
         number of times with optional whitespace/newlines between
         repetitions. Real vocabulary entries never contain this exact
         4-character run.
      2. Remove any leftover *isolated* single "际" (a stray fragment left
         when the repeated watermark line wraps mid-phrase) -- but only
         when it's surrounded by whitespace on both sides, i.e. it isn't
         glued to real word/pinyin text. No real HSK entry is the single
         character 际 on its own.
    Also strips the repeated column-header row ("序号 等级 词语 拼音 词性")
    that reprints at the top of every page.
    """
    # Pass 1: the watermark phrase itself, one or more repetitions.
    text = re.sub(r"(?:汉考国际\s*){1,}", " ", text)
    # Pass 2: stray leftover "际" fragments, isolated by whitespace.
    text = re.sub(r"(?<=\s)际(?=\s)", " ", text)
    # Repeated header row.
    text = text.replace("序号 等级 词语 拼音 词性", " ")
    # Collapse whitespace runs for a cleaner regex pass later.
    text = re.sub(r"[ \t]+", " ", text)
    return text


# --------------------------------------------------------------------------
# 3. Parse vocabulary entries
# --------------------------------------------------------------------------
PINYIN_CHAR = r"[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńň'’\u00b7]"

ENTRY_RE = re.compile(
    r"""
    (?P<no>\d{1,5})\s+
    (?P<level>\d(?:-\d)?)
    (?P<variant>（[\d,、\- ]*(?:7-9)?[\d,、\- ]*）)?\s*
    (?P<word>[\u4e00-\u9fff·]+\d?)\s+
    (?P<pinyin>(?:""" + PINYIN_CHAR + r"""+\s?)+?)\s+
    (?P<pos>(?=\d{1,5}\s+\d)|[\u4e00-\u9fff、（）\s]+?)(?=\s+\d{1,5}\s+\d|\s*$)
    """,
    re.VERBOSE,
)


def parse_entries(vocab_text: str):
    entries = []
    for m in ENTRY_RE.finditer(vocab_text):
        level_raw = m.group("level")
        word = m.group("word").rstrip("0123456789")
        pinyin = m.group("pinyin").strip()
        entries.append({"level": level_raw, "word": word, "pinyin": pinyin})
    return entries


# --------------------------------------------------------------------------
# 4. English translations
# --------------------------------------------------------------------------
def load_translation_dict(cache_path: Path) -> dict:
    """Download (and cache locally) the translation JSON, return a lookup
    keyed by simplified word -> list of {pinyin, meanings} per reading."""
    if cache_path.exists():
        raw = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        print(f"Downloading translations from {TRANSLATION_URL} ...")
        resp = requests.get(TRANSLATION_URL, timeout=30)
        resp.raise_for_status()
        raw = resp.json()
        cache_path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")

    lookup = {}
    for item in raw:
        word = item.get("simplified", "")
        readings = []
        for form in item.get("forms", []):
            pinyin = form.get("transcriptions", {}).get("pinyin", "")
            meanings = form.get("meanings", [])
            readings.append({"pinyin": pinyin, "meanings": meanings})
        lookup[word] = readings
    return lookup


def normalize_pinyin(s: str) -> str:
    """Strip spaces/apostrophes/case so pinyin from the two different
    sources can be compared even if their spacing conventions differ."""
    s = s.replace(" ", "").replace("'", "").replace("’", "")
    s = unicodedata.normalize("NFC", s)
    return s.lower()


def translate(word: str, pinyin: str, translation_dict: dict):
    """Return an English gloss for (word, pinyin), or None if no match.

    A character can have several *different senses* filed under the exact
    same pinyin (e.g. 后 hòu: "surname Hou" / "empress" / "after, behind").
    We combine the meanings from every reading whose pinyin matches, rather
    than only the first one -- taking just the first form alphabetically/
    positionally sometimes surfaces an obscure sense (like a surname) ahead
    of the common one.
    """
    readings = translation_dict.get(word)
    if not readings:
        return None

    target = normalize_pinyin(pinyin)
    matched = [r for r in readings if normalize_pinyin(r["pinyin"]) == target]

    # Fall back to every reading if pinyin didn't line up at all (e.g.
    # minor formatting differences between the two sources).
    pool = matched if matched else readings

    seen = set()
    meanings = []
    for r in pool:
        for m in r["meanings"]:
            if m not in seen:
                seen.add(m)
                meanings.append(m)
    return "; ".join(meanings) if meanings else None


# --------------------------------------------------------------------------
# 5. Write outputs
# --------------------------------------------------------------------------
def write_outputs(entries, outdir: Path):
    outdir.mkdir(parents=True, exist_ok=True)
    fieldnames = ["level", "word", "pinyin", "english"]

    all_csv = outdir / "hsk_vocab_all.csv"
    with open(all_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(entries)

    all_json = outdir / "hsk_vocab_all.json"
    with open(all_json, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    by_level = {}
    for e in entries:
        by_level.setdefault(e["level"], []).append(e)
    for level, rows in sorted(by_level.items()):
        path = outdir / f"hsk_vocab_level_{level}.csv"
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)

    missing = [e for e in entries if not e["english"]]
    missing_csv = outdir / "hsk_vocab_missing_translations.csv"
    with open(missing_csv, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=["level", "word", "pinyin"])
        writer.writeheader()
        for e in missing:
            writer.writerow({"level": e["level"], "word": e["word"], "pinyin": e["pinyin"]})

    return all_csv, all_json, missing_csv, by_level, len(missing)


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: python parse_hsk_vocab_v2.py path/to/syllabus.pdf")

    pdf_path = sys.argv[1]
    outdir = Path("hsk_vocab_output")
    outdir.mkdir(parents=True, exist_ok=True)

    print(f"Extracting text from {pdf_path} ...")
    full_text = extract_full_text(pdf_path)

    print("Isolating vocabulary section ...")
    vocab_text = isolate_vocab_section(full_text)

    print("Stripping watermark and page-header noise ...")
    vocab_text = sanitize_watermark(vocab_text)

    print("Parsing entries ...")
    entries = parse_entries(vocab_text)
    print(f"Parsed {len(entries)} vocabulary entries.")

    translation_dict = load_translation_dict(outdir / "_translation_cache.json")

    print("Matching translations ...")
    for e in entries:
        e["english"] = translate(e["word"], e["pinyin"], translation_dict) or ""

    all_csv, all_json, missing_csv, by_level, n_missing = write_outputs(entries, outdir)

    print(f"\nWrote:\n  {all_csv}\n  {all_json}\n  {missing_csv}  ({n_missing} words with no translation match)")
    for level, rows in sorted(by_level.items()):
        matched = sum(1 for r in rows if r["english"])
        print(f"  {outdir / f'hsk_vocab_level_{level}.csv'}  ({len(rows)} words, {matched} translated)")


if __name__ == "__main__":
    main()
