// Craft highlighting for CodeMirror. Keyword sets follow the VS Code
// extension's TextMate grammar (syntaxes/craft.tmLanguage.json).
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set([
  'services', 'domains', 'domain', 'actors', 'actor', 'arch', 'exposure', 'tags',
  'context_map', 'glossary', 'use_case', 'when', 'asks', 'notifies', 'listens',
  'returns', 'receives', 'stream', 'one', 'of', 'cron', 'every', 'surface', 'query',
  'command', 'scenario', 'alt', 'opt', 'else', 'par', 'and', 'loop', 'note',
  'finding', 'includes', 'continues',
  // context_map patterns and glossary verbs
  'customer_supplier', 'conformist', 'anticorruption_layer', 'open_host_service',
  'published_language', 'partnership', 'shared_kernel', 'separate_ways',
  'same_as', 'contrasts', 'distinct_from',
]);
const ACTOR_KINDS = new Set(['user', 'system', 'service', 'scheduler', 'tool', 'infra']);

const craft = StreamLanguage.define({
  startState: () => ({ inBlockComment: false }),
  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.skipTo('*/')) { stream.match('*/'); state.inBlockComment = false; } else stream.skipToEnd();
      return 'comment';
    }
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match('/*')) { state.inBlockComment = true; return 'comment'; }
    if (stream.match(/^"(?:[^"\\]|\\.)*"?/)) return 'string';
    // Trailing operation annotation: [POST /v1/users] or [framework:react]
    if (stream.match(/^\[[^\]\n]*\]?/)) return 'meta';
    // Property keys: contexts:, data-stores:, presentation:, to:, ...
    if (stream.match(/^[A-Za-z_][\w-]*(?=\s*:(?!\w))/)) return 'propertyName';
    const word = stream.match(/^[A-Za-z_][\w-]*/);
    if (word) {
      const w = word[0];
      if (KEYWORDS.has(w)) return 'keyword';
      if (ACTOR_KINDS.has(w)) return 'atom';
      if (w === 'true' || w === 'false') return 'bool';
      return /^[A-Z]/.test(w) ? 'typeName' : 'variableName';
    }
    if (stream.match(/^\d+(\.\d+)?%?/)) return 'number';
    if (stream.match(/^(->|>)/)) return 'operator';
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: '//', block: { open: '/*', close: '*/' } } },
});

const style = HighlightStyle.define([
  { tag: t.keyword, color: '#0055cc', fontWeight: '600' },
  { tag: t.comment, color: '#6b778c', fontStyle: 'italic' },
  { tag: t.string, color: '#216e4e' },
  { tag: t.meta, color: '#943d73' },
  { tag: t.propertyName, color: '#a54800' },
  { tag: t.atom, color: '#5e4db2' },
  { tag: [t.bool, t.number], color: '#a54800' },
  { tag: t.typeName, color: '#172b4d', fontWeight: '500' },
  { tag: t.operator, color: '#626f86' },
]);

export const craftLanguage = [craft, syntaxHighlighting(style)];
