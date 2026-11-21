/**
 * Help-chatbot matching engine. Runs fully in the browser: the user's question is never sent anywhere.
 *
 * Layer 1 (lexical, instant): Fuse.js fuzzy search + an IDF-weighted, typo-tolerant word overlap,
 *   both over "pertanyaan" + "variasi" after normalising slang/abbreviations.
 * Layer 2 (semantic, optional): cosine similarity from a multilingual embedding model, computed in a
 *   Web Worker (see faq.worker.ts). When it is unavailable the lexical score is used on its own.
 *
 * No React / DOM here, so this file can be tested directly with Node.
 */
import Fuse from "fuse.js";
import type { Candidate, FaqItem, FaqRole, MatchResult, SemanticScores } from "./types";

/* ------------------------------------------------------------------ */
/* Tunable constants                                                   */
/* ------------------------------------------------------------------ */

/** Score at or above this → answer directly. */
export const SKOR_JAWAB_LANGSUNG = 0.6;
/** Score at or above this (but below the one above) → ask back "Maksudnya yang ini?". Below → "belum paham". */
export const SKOR_TANYA_BALIK = 0.4;
/** If the top two answers are closer than this (and the top one isn't very sure), ask back instead of guessing. */
export const SELISIH_MINIMUM = 0.06;
/** A top score at or above this is answered even when the runner-up is close. */
export const SKOR_SANGAT_YAKIN = 0.8;
/** How many choices to offer in "Maksudnya yang ini?" */
export const MAKS_PILIHAN = 3;

/** Weight of the semantic layer in the final score when it is available (0..1). */
export const BOBOT_SEMANTIK = 0.55;
/** Cosine similarity mapped to 0 (unrelated) and 1 (same meaning) for this model. */
export const COS_BAWAH = 0.3;
export const COS_ATAS = 0.85;

/** Lexical layer: Fuse.js share vs. word-overlap share. */
const BOBOT_FUSE = 0.4;

/* ------------------------------------------------------------------ */
/* Role filter                                                         */
/* ------------------------------------------------------------------ */

/** FAQ roles visible to an app role (servant / coordinator / superadmin). */
export function faqRolesFor(appRole: string | undefined, coordinatesSomething: boolean): FaqRole[] {
  if (appRole === "superadmin") return ["jemaat", "koordinator", "admin"];
  if (appRole === "coordinator" && coordinatesSomething) return ["jemaat", "koordinator"];
  return ["jemaat"];
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

/** Everyday spellings / abbreviations → one canonical word. */
const SINONIM: Record<string, string> = {
  gmn: "bagaimana", gmna: "bagaimana", gmana: "bagaimana", gimana: "bagaimana", bgmn: "bagaimana", bgmana: "bagaimana", gimn: "bagaimana", caranya: "cara", gmnn: "bagaimana",
  gk: "tidak", ga: "tidak", gak: "tidak", nggak: "tidak", ngga: "tidak", enggak: "tidak", engga: "tidak", tdk: "tidak", tak: "tidak", g: "tidak",
  bs: "bisa", bsa: "bisa", sy: "saya", aku: "saya", gw: "saya", gue: "saya", sya: "saya",
  yg: "yang", dmn: "dimana", dmana: "dimana", mana: "dimana", utk: "untuk", untk: "untuk", buat: "untuk",
  jdwl: "jadwal", jadwl: "jadwal", jdwal: "jadwal", schedule: "jadwal",
  pw: "password", pass: "password", pasword: "password", passwd: "password", paswod: "password", sandi: "password", sandinya: "password",
  wa: "whatsapp", whatsap: "whatsapp", watsap: "whatsapp", whatapp: "whatsapp",
  notif: "notifikasi", notifnya: "notifikasi", pemberitahuan: "notifikasi",
  tgl: "tanggal", mgg: "minggu", dgn: "dengan", krn: "karena", karna: "karena",
  udh: "sudah", udah: "sudah", sdh: "sudah", dah: "sudah", blm: "belum", blum: "belum", kpn: "kapan",
  pengen: "mau", pingin: "mau", pengin: "mau", ingin: "mau", mo: "mau",
  makasih: "terimakasih", makasi: "terimakasih", mksh: "terimakasih", trims: "terimakasih", tq: "terimakasih", thanks: "terimakasih", thx: "terimakasih", tengkyu: "terimakasih",
  hallo: "halo", helo: "halo", hai: "halo", hi: "halo", hello: "halo",
  login: "masuk", signin: "masuk", logout: "keluar", signout: "keluar",
  dateng: "datang", dtg: "datang", hadirr: "hadir", izin: "berhalangan", ijin: "berhalangan", halangan: "berhalangan",
  gantiin: "ganti", gantikan: "ganti", menggantikan: "ganti", pengganti: "ganti",
  pelayanan: "melayani", pelayan: "melayani", tugas: "tugas",
  hp: "hp", handphone: "hp", ponsel: "hp",
  install: "pasang", instal: "pasang", download: "pasang",
  foto: "foto", poto: "foto", photo: "foto",
};

/** Words that carry no meaning for matching. */
const STOPWORDS = new Set([
  "dong", "sih", "ya", "yah", "deh", "nih", "kak", "min", "pak", "bu", "bang", "mas", "mbak", "tolong", "mohon", "bantu",
  "di", "ke", "dari", "dan", "atau", "itu", "ini", "nya", "kah", "lah", "pun", "the", "a", "apa", "apakah", "adalah",
  "saya", "kamu", "bagaimana", "cara", "untuk", "yang", "mau", "bisa", "dengan", "kalau", "kalo", "jika", "agar", "supaya", "aja", "saja",
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/terima\s+kasih/g, "terimakasih")
    .replace(/kata\s+sandi/g, "password")
    .replace(/log\s+(in|out)/g, (_, w) => `log${w}`)
    .replace(/sign\s+(in|out)/g, (_, w) => `sign${w}`)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/([a-z])\1{2,}/g, "$1") // makasiiih → makasih
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => SINONIM[w] ?? w)
    .join(" ");
}

function tokens(normalized: string): string[] {
  return normalized.split(" ").filter((w) => w && !STOPWORDS.has(w));
}

/** Levenshtein distance with an early exit once it exceeds `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** 1 = same word, 0.8 = typo / prefix, 0 = different. */
function wordSimilarity(q: string, w: string): number {
  if (q === w) return 1;
  if (q.length >= 4 && w.length >= 4 && (w.startsWith(q) || q.startsWith(w))) return 0.8;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  return max && editDistance(q, w, max) <= max ? 0.8 : 0;
}

/* ------------------------------------------------------------------ */
/* Index                                                               */
/* ------------------------------------------------------------------ */

interface Doc {
  item: FaqItem;
  pertanyaanN: string;
  variasiN: string[];
  words: Set<string>;
}

export interface FaqIndex {
  docs: Doc[];
  fuse: Fuse<Doc>;
  idf: Map<string, number>;
}

export function buildIndex(items: FaqItem[]): FaqIndex {
  const docs: Doc[] = items.map((item) => {
    const pertanyaanN = normalize(item.pertanyaan);
    const variasiN = item.variasi.map(normalize);
    const words = new Set([pertanyaanN, ...variasiN].flatMap(tokens));
    return { item, pertanyaanN, variasiN, words };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const w of d.words) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [w, n] of df) idf.set(w, Math.log(1 + docs.length / n));

  const fuse = new Fuse(docs, {
    keys: [
      { name: "pertanyaanN", weight: 2 },
      { name: "variasiN", weight: 1.5 },
    ],
    includeScore: true,
    ignoreLocation: true,
    threshold: 0.5,
    minMatchCharLength: 2,
  });
  return { docs, fuse, idf };
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** IDF-weighted share of the question's words found (allowing typos) in an entry. */
function overlapScore(qWords: string[], doc: Doc, idf: Map<string, number>): number {
  if (!qWords.length) return 0;
  let total = 0;
  let hit = 0;
  for (const q of qWords) {
    const weight = idf.get(q) ?? Math.log(1 + 100); // unknown word: count it fully against the score
    total += weight;
    let best = 0;
    for (const w of doc.words) {
      const s = wordSimilarity(q, w);
      if (s > best) best = s;
      if (best === 1) break;
    }
    hit += best * (idf.get(q) ?? weight);
  }
  return hit / total;
}

export function lexicalScores(index: FaqIndex, question: string): Map<string, number> {
  const qn = normalize(question);
  const qWords = tokens(qn);
  const out = new Map<string, number>();
  if (!qn) return out;

  const fuseSim = new Map<string, number>();
  for (const r of index.fuse.search(qn)) fuseSim.set(r.item.item.id, 1 - (r.score ?? 1));

  for (const d of index.docs) {
    // exact phrase match (after normalisation) is a sure hit
    if (qn === d.pertanyaanN || d.variasiN.includes(qn)) {
      out.set(d.item.id, 1);
      continue;
    }
    const f = fuseSim.get(d.item.id) ?? 0;
    const o = overlapScore(qWords.length ? qWords : qn.split(" "), d, index.idf);
    out.set(d.item.id, BOBOT_FUSE * f + (1 - BOBOT_FUSE) * o);
  }
  return out;
}

function semanticNorm(cos: number) {
  return Math.min(1, Math.max(0, (cos - COS_BAWAH) / (COS_ATAS - COS_BAWAH)));
}

/** Ranks every entry. Pass `semantic` when the embedding model is ready. */
export function rank(index: FaqIndex, question: string, semantic?: SemanticScores | null): Candidate[] {
  const lex = lexicalScores(index, question);
  return index.docs
    .map(({ item }) => {
      const l = lex.get(item.id) ?? 0;
      const cos = semantic?.[item.id];
      if (cos === undefined) return { item, score: l, lexical: l, semantic: null };
      const s = semanticNorm(cos);
      // a sure lexical hit (exact variant) is never pulled down by the model
      const score = l >= 0.95 ? l : (1 - BOBOT_SEMANTIK) * l + BOBOT_SEMANTIK * s;
      return { item, score, lexical: l, semantic: cos };
    })
    .sort((a, b) => b.score - a.score);
}

/** Decides: answer directly, ask back, or admit not understanding. */
export function decide(ranked: Candidate[]): MatchResult {
  const [top, second] = ranked;
  if (!top || top.score < SKOR_TANYA_BALIK) return { kind: "unknown", ranked };
  const clear = !second || top.score - second.score >= SELISIH_MINIMUM || top.score >= SKOR_SANGAT_YAKIN;
  if (top.score >= SKOR_JAWAB_LANGSUNG && clear) return { kind: "answer", best: top, ranked };
  const options = ranked.filter((c) => c.score >= SKOR_TANYA_BALIK * 0.8).slice(0, MAKS_PILIHAN);
  return { kind: "clarify", options, ranked };
}

export function match(index: FaqIndex, question: string, semantic?: SemanticScores | null): MatchResult {
  return decide(rank(index, question, semantic));
}

/** Up to `n` other questions from the same category (for "Pertanyaan terkait"). */
export function related(items: FaqItem[], item: FaqItem, n = 3): FaqItem[] {
  return items.filter((x) => x.kategori === item.kategori && x.id !== item.id).slice(0, n);
}
