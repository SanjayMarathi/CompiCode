import { useEffect, useState } from 'react';

// Sky-blue / orange Monaco themes that match the app palette.
export function defineArenaThemes(monaco) {
  const common = (c) => ({
    base: c.base,
    inherit: false, // never fall back to the stock blue/green/orange syntax colours
    rules: [
      { token: '', foreground: c.fg },
      { token: 'comment', foreground: c.dim, fontStyle: 'italic' },
      { token: 'keyword', foreground: c.kw, fontStyle: 'bold' },
      { token: 'keyword.directive', foreground: c.kw, fontStyle: 'bold' },
      { token: 'string', foreground: c.str },
      { token: 'string.include', foreground: c.str },
      { token: 'string.escape', foreground: c.num },
      { token: 'number', foreground: c.num },
      { token: 'type', foreground: c.type, fontStyle: 'bold' },
      { token: 'type.identifier', foreground: c.type, fontStyle: 'bold' },
      { token: 'namespace', foreground: c.type },
      { token: 'predefined', foreground: c.pre },
      { token: 'delimiter', foreground: c.punct },
      { token: 'operator', foreground: c.punct },
      { token: 'variable', foreground: c.fg },
      { token: 'identifier', foreground: c.fg },
      { token: 'annotation', foreground: c.pre },
      { token: 'regexp', foreground: c.str },
    ],
    colors: {
      'editor.background': c.bg,
      'editor.foreground': c.fg,
      'editorLineNumber.foreground': c.dim,
      'editorLineNumber.activeForeground': c.fg,
      'editor.lineHighlightBackground': c.line,
      'editor.lineHighlightBorder': c.line,
      'editor.selectionBackground': c.sel,
      'editor.inactiveSelectionBackground': c.line,
      'editorCursor.foreground': c.fg,
      'editorBracketMatch.background': c.line,
      'editorBracketMatch.border': c.dim,
      'editorBracketHighlight.foreground1': c.fg,
      'editorBracketHighlight.foreground2': c.fg,
      'editorBracketHighlight.foreground3': c.fg,
      'editorBracketHighlight.foreground4': c.fg,
      'editorBracketHighlight.foreground5': c.fg,
      'editorBracketHighlight.foreground6': c.fg,
      'editorIndentGuide.background1': c.guide,
      'editorIndentGuide.activeBackground1': c.dim,
      'editorWhitespace.foreground': c.guide,
      'editorWidget.background': c.bg,
      'editorWidget.border': c.guide,
      'editorSuggestWidget.background': c.bg,
      'editorSuggestWidget.border': c.guide,
      'editorSuggestWidget.selectedBackground': c.line,
      'scrollbarSlider.background': c.guide + '99',
      'scrollbarSlider.hoverBackground': c.dim + '88',
    },
  });

  monaco.editor.defineTheme('arena-light', common({
    base: 'vs', bg: '#ffffff', fg: '#0d2744', dim: '#8499ad', punct: '#5b7a92',
    kw: '#0a7fb0', type: '#0b9a8a', str: '#d9590b', num: '#0b9a8a', pre: '#1a6fa8',
    line: '#f1f9fb', sel: '#c9eef0', guide: '#e1eff3',
  }));
  monaco.editor.defineTheme('arena-dark', common({
    base: 'vs-dark', bg: '#060a0f', fg: '#e8f7fb', dim: '#5d7889', punct: '#7fa0b5',
    kw: '#4cc9f0', type: '#2fe8d8', str: '#ff9a4a', num: '#ffb36b', pre: '#8fcdf5',
    line: '#0b131b', sel: '#12384c', guide: '#14212c',
  }));
}

export const readTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

/** Tracks <html data-theme> so Monaco follows the navbar toggle live. */
export function useDocumentTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export const monacoThemeName = (theme) => (theme === 'light' ? 'arena-light' : 'arena-dark');
export const EDITOR_FONT = "'JetBrains Mono', Consolas, monospace";

/** Shared editor options; bracket-pair colouring stays off to keep the editor calm. */
export const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontFamily: EDITOR_FONT,
  fontLigatures: false,
  bracketPairColorization: { enabled: false },
  guides: { bracketPairs: false },
  scrollBeyondLastLine: false,
};

/** Web fonts may land after Monaco measured glyphs; re-measure so the caret doesn't drift. */
export function onEditorMount(_editor, monaco) {
  if (document.fonts?.ready) document.fonts.ready.then(() => monaco.editor.remeasureFonts());
}
