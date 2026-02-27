import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string | number;
  minHeight?: number;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}


const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('sentinel-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword',        foreground: '06B6D4', fontStyle: 'bold' },
      { token: 'string',         foreground: '86EFAC' },
      { token: 'number',         foreground: 'FCA5A5' },
      { token: 'comment',        foreground: '4B5563', fontStyle: 'italic' },
      { token: 'operator',       foreground: '94A3B8' },
      { token: 'identifier',     foreground: 'E2E8F0' },
      { token: 'type',           foreground: 'A78BFA' },
      { token: 'function',       foreground: '67E8F9' },
      { token: 'delimiter',      foreground: '64748B' },
    ],
    colors: {
      'editor.background':           '#060d1a',
      'editor.foreground':           '#CBD5E1',
      'editor.lineHighlightBackground': '#0B1628',
      'editor.selectionBackground':  '#06B6D420',
      'editor.inactiveSelectionBackground': '#06B6D410',
      'editorLineNumber.foreground': '#2D3748',
      'editorLineNumber.activeForeground': '#4B5563',
      'editorCursor.foreground':     '#06B6D4',
      'editorIndentGuide.background1': '#1E293B',
      'editorIndentGuide.activeBackground1': '#334155',
      'scrollbar.shadow':            '#00000000',
      'scrollbarSlider.background':  '#1E293B80',
      'scrollbarSlider.hoverBackground': '#334155',
      'scrollbarSlider.activeBackground': '#475569',
      'editor.findMatchBackground':  '#06B6D430',
      'editor.findMatchHighlightBackground': '#06B6D415',
      'editorWidget.background':     '#0F1520',
      'editorWidget.border':         '#1E293B',
      'input.background':            '#0B1628',
      'input.foreground':            '#CBD5E1',
      'input.border':                '#1E293B',
    },
  });
};

const handleMount: OnMount = (editor) => {
  
  editor.updateOptions({
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
    fontLigatures: true,
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 0.3,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'gutter',
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    padding: { top: 12, bottom: 12 },
    wordWrap: 'on',
    lineNumbers: 'on',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 3,
    renderWhitespace: 'none',
    contextmenu: true,
    quickSuggestions: { other: true, comments: false, strings: false },
    suggestOnTriggerCharacters: true,
    tabSize: 2,
    insertSpaces: true,
    formatOnPaste: true,
    formatOnType: false,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: false, indentation: true },
  });
};

export function MonacoEditor({
  value,
  onChange,
  language = 'sql',
  height = '100%',
  minHeight,
  readOnly = false,
  className = '',
}: MonacoEditorProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-white/[0.08] bg-[#060d1a] ${className}`}
      style={minHeight ? { minHeight } : undefined}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme="sentinel-dark"
        beforeMount={defineTheme}
        onMount={handleMount}
        onChange={(v) => onChange(v ?? '')}
        options={{
          readOnly,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          padding: { top: 12, bottom: 12 },
          wordWrap: 'on',
          lineNumbers: 'on',
          glyphMargin: false,
          folding: false,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, monospace',
          fontSize: 12,
          lineHeight: 20,
          renderLineHighlight: 'gutter',
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          contextmenu: true,
          quickSuggestions: { other: true, comments: false, strings: false },
          tabSize: 2,
          bracketPairColorization: { enabled: true },
        }}
        loading={
          <div className="flex items-center justify-center h-full gap-2 text-text-muted">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Loading editor...</span>
          </div>
        }
      />
    </div>
  );
}
