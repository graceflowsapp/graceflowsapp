/** Who may see an FAQ entry. "jemaat" = every signed-in member. */
export type FaqRole = "jemaat" | "koordinator" | "admin";

/** One entry of src/data/faq.json */
export interface FaqItem {
  id: string;
  kategori: string;
  pertanyaan: string;
  /** 4–6 other ways people ask the same thing (slang, abbreviations, typos) */
  variasi: string[];
  jawaban: string;
  /** Numbered steps (max 6). Empty for greetings / short explanations. */
  langkah: string[];
  /** In-app route for the "Bawa saya ke sana" button, or null */
  link: string | null;
  role: FaqRole;
  /** Source file, for manual checking */
  sumber: string;
}

export interface Candidate {
  item: FaqItem;
  /** Final combined score 0..1 */
  score: number;
  lexical: number;
  semantic: number | null;
}

export type MatchResult =
  | { kind: "answer"; best: Candidate; ranked: Candidate[] }
  | { kind: "clarify"; options: Candidate[]; ranked: Candidate[] }
  | { kind: "unknown"; ranked: Candidate[] };

/** Raw cosine similarity per FAQ id (best over pertanyaan + variasi), from the embedding model. */
export type SemanticScores = Record<string, number>;
