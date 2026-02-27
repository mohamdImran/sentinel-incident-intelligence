import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

function highlightESSQL(code: string): string {
  const keywords = ['FROM', 'WHERE', 'STATS', 'BY', 'SORT', 'LIMIT', 'EVAL', 'KEEP', 'DROP', 'RENAME', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'RLIKE', 'IS', 'NULL', 'TRUE', 'FALSE', 'ASC', 'DESC'];
  const functions = ['AVG', 'MAX', 'MIN', 'SUM', 'COUNT', 'PERCENTILE', 'BUCKET', 'SUBSTRING', 'NOW', 'DATE_FORMAT', 'CONCAT', 'ROUND', 'ABS', 'LOG'];

  let result = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  keywords.forEach(kw => {
    result = result.replace(new RegExp(`\\b${kw}\\b`, 'g'), `<span class="esql-keyword">${kw}</span>`);
  });

  functions.forEach(fn => {
    result = result.replace(new RegExp(`\\b${fn}\\b`, 'g'), `<span class="esql-function">${fn}</span>`);
  });

  result = result.replace(/'([^']*)'/g, `<span class="esql-string">'$1'</span>`);
  result = result.replace(/\b(\d+(\.\d+)?)\b/g, `<span class="esql-number">$1</span>`);
  result = result.replace(/(\/\/.*$)/gm, `<span class="esql-comment">$1</span>`);

  return result;
}

interface CodeBlockProps {
  code: string;
  language?: 'esql' | 'json' | 'sql';
  maxHeight?: string;
  showCopy?: boolean;
  className?: string;
}

export function CodeBlock({ code, language = 'esql', maxHeight = '200px', showCopy = true, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlighted = language === 'esql' ? highlightESSQL(code) : code;

  return (
    <div className={`relative group rounded-lg bg-elevated border border-white/[0.06] overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
          {language === 'esql' ? 'ES|QL' : language.toUpperCase()}
        </span>
        {showCopy && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
          >
            {copied ? <Check size={10} className="text-status-ok" /> : <Copy size={10} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <div
        className="overflow-auto p-3 text-xs font-mono leading-relaxed text-text-secondary"
        style={{ maxHeight }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
