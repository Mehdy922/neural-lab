import { S } from "../theme.js";

export function Corpus({ text, highlight = [] }) {
  const hl = new Set(highlight.map((w) => String(w).toLowerCase()));
  const paras = String(text || "").split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div style={S.corpus}>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: i ? "10px 0 0" : 0 }}>
          {p.split(/(\s+)/).map((piece, k) => {
            const m = piece.match(/^([^a-z0-9']*)([a-z0-9']+)(.*)$/i);
            if (!m) return piece;
            const [, lead, word, trail] = m;
            return hl.has(word.toLowerCase())
              ? <span key={k}>{lead}<mark style={S.hl}>{word}</mark>{trail}</span>
              : piece;
          })}
        </p>
      ))}
    </div>
  );
}
