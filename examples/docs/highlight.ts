/**
 * Tiny syntax highlighter for the documentation code blocks: TypeScript / TSX,
 * CSS and shell. It only colours tokens; it never needs to be a full parser.
 */

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'literal' | 'type' | 'function' | 'tag' | 'attr' | 'property' | 'punct';

export interface Token {
  readonly kind: TokenKind;
  readonly text: string;
}

export type Language = 'tsx' | 'ts' | 'css' | 'sh';

const KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'declare', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'from', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'keyof', 'let', 'new', 'of', 'readonly', 'return', 'satisfies',
  'switch', 'throw', 'try', 'type', 'typeof', 'var', 'void', 'while', 'yield',
]);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'this', 'NaN', 'Infinity']);
const BUILTIN_TYPES = new Set(['string', 'number', 'boolean', 'unknown', 'never', 'any', 'object', 'bigint', 'symbol']);

const IDENT = /[A-Za-z_$][\w$]*/y;
const NUMBER = /(?:0[xX][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?)/y;

function push(tokens: Token[], kind: TokenKind, text: string): void {
  const last = tokens[tokens.length - 1];
  if (last && last.kind === kind) tokens[tokens.length - 1] = { kind, text: last.text + text };
  else tokens.push({ kind, text });
}

function readString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === '\\') index += 2;
    else if (char === quote) return index + 1;
    else if (char === '\n' && quote !== '`') return index;
    else index++;
  }
  return index;
}

/** Last significant (non-blank, non-comment) token, used to tell `<Tag` from `a < b` or generics. */
function previousSignificant(tokens: readonly Token[]): Token | undefined {
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index]!;
    if (token.kind === 'comment') continue;
    if (token.kind === 'plain' && token.text.trim() === '') continue;
    return token;
  }
  return undefined;
}

function tagCanStart(tokens: readonly Token[]): boolean {
  const previous = previousSignificant(tokens);
  if (!previous) return true;
  if (previous.kind === 'keyword') return previous.text === 'return' || previous.text === 'default' || previous.text === 'await';
  if (previous.kind === 'punct' || previous.kind === 'plain') {
    const last = previous.text.trimEnd().slice(-1);
    return '(,=?:{[&|>}'.includes(last) || previous.text.trimEnd().endsWith('=>');
  }
  return previous.kind === 'tag';
}

export function highlightScript(source: string, jsx: boolean): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  /** JSX state: depth of open elements whose children are text, and whether we are inside a tag. */
  let inTag = false;
  let tagBraces = 0;
  let childDepth = 0;
  const braceStack: ('code' | 'jsx-expr')[] = [];

  const word = (start: number): string => {
    IDENT.lastIndex = start;
    return IDENT.exec(source)?.[0] ?? '';
  };

  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];

    // JSX children text, between `>` and `<` / `{`.
    if (jsx && childDepth > 0 && !inTag && braceStack[braceStack.length - 1] !== 'code') {
      if (char !== '<' && char !== '{') {
        let end = index;
        while (end < source.length && source[end] !== '<' && source[end] !== '{') end++;
        push(tokens, 'plain', source.slice(index, end));
        index = end;
        continue;
      }
    }

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      const stop = end === -1 ? source.length : end;
      push(tokens, 'comment', source.slice(index, stop));
      index = stop;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end === -1 ? source.length : end + 2;
      push(tokens, 'comment', source.slice(index, stop));
      index = stop;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const stop = readString(source, index);
      push(tokens, inTag ? 'string' : 'string', source.slice(index, stop));
      index = stop;
      continue;
    }
    if (/\d/.test(char)) {
      NUMBER.lastIndex = index;
      const match = NUMBER.exec(source);
      if (match) {
        push(tokens, 'number', match[0]);
        index += match[0].length;
        continue;
      }
    }

    if (jsx && char === '<' && !inTag) {
      const closing = next === '/';
      const nameStart = index + (closing ? 2 : 1);
      const name = word(nameStart);
      const fragment = source[nameStart] === '>';
      if ((name || fragment) && (closing || tagCanStart(tokens) || childDepth > 0)) {
        push(tokens, 'punct', source.slice(index, nameStart));
        if (name) {
          // Dotted names (Context.Provider).
          let end = nameStart + name.length;
          while (source[end] === '.' && word(end + 1)) end += 1 + word(end + 1).length;
          tokens.push({ kind: 'tag', text: source.slice(nameStart, end) });
          index = end;
        } else index = nameStart;
        if (closing) {
          childDepth = Math.max(0, childDepth - 1);
          inTag = true;
          tagBraces = -1; // marks a closing tag
        } else {
          inTag = true;
          tagBraces = 0;
        }
        continue;
      }
    }

    if (jsx && inTag) {
      if (char === '/' && next === '>') {
        push(tokens, 'punct', '/>');
        inTag = false;
        index += 2;
        continue;
      }
      if (char === '>' && tagBraces <= 0) {
        push(tokens, 'punct', '>');
        if (tagBraces === 0) childDepth++;
        inTag = false;
        index++;
        continue;
      }
      if (char === '{') {
        push(tokens, 'punct', '{');
        braceStack.push('code');
        const saved = { childDepth };
        // Parse the attribute expression as code until the matching brace.
        let depth = 1;
        let end = index + 1;
        while (end < source.length && depth > 0) {
          const c = source[end];
          if (c === '"' || c === "'" || c === '`') {
            end = readString(source, end);
            continue;
          }
          if (c === '{') depth++;
          else if (c === '}') depth--;
          if (depth > 0) end++;
        }
        const inner = highlightScript(source.slice(index + 1, end), true);
        for (const token of inner) push(tokens, token.kind, token.text);
        braceStack.pop();
        childDepth = saved.childDepth;
        if (end < source.length) push(tokens, 'punct', '}');
        index = end + 1;
        continue;
      }
      const name = word(index);
      if (name) {
        // `name=` or a bare boolean attribute.
        let end = index + name.length;
        while (source[end] === '-' && word(end + 1)) end += 1 + word(end + 1).length;
        tokens.push({ kind: 'attr', text: source.slice(index, end) });
        index = end;
        continue;
      }
      push(tokens, 'plain', char);
      index++;
      continue;
    }

    if (jsx && childDepth > 0 && char === '{') {
      // Expression inside JSX children: highlight as code up to the matching brace.
      let depth = 1;
      let end = index + 1;
      while (end < source.length && depth > 0) {
        const c = source[end];
        if (c === '"' || c === "'" || c === '`') {
          end = readString(source, end);
          continue;
        }
        if (c === '/' && source[end + 1] === '/') {
          const stop = source.indexOf('\n', end);
          end = stop === -1 ? source.length : stop;
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        if (depth > 0) end++;
      }
      push(tokens, 'punct', '{');
      const inner = highlightScript(source.slice(index + 1, end), true);
      for (const token of inner) push(tokens, token.kind, token.text);
      if (end < source.length) push(tokens, 'punct', '}');
      index = end + 1;
      continue;
    }

    const name = word(index);
    if (name) {
      const after = source.slice(index + name.length).match(/^\s*(\()?/);
      const previous = previousSignificant(tokens);
      const afterDot = previous?.kind === 'punct' && previous.text.endsWith('.') && !previous.text.endsWith('..');
      let kind: TokenKind = 'plain';
      if (afterDot) kind = after?.[1] ? 'function' : 'property';
      else if (KEYWORDS.has(name)) kind = 'keyword';
      else if (LITERALS.has(name)) kind = 'literal';
      else if (BUILTIN_TYPES.has(name)) kind = 'type';
      else if (after?.[1]) kind = 'function';
      else if (/^[A-Z]/.test(name)) kind = 'type';
      else if (source.slice(index + name.length).match(/^\??:\s/) && /[{,(]\s*$/.test(source.slice(Math.max(0, index - 40), index))) kind = 'property';
      tokens.push({ kind, text: name });
      index += name.length;
      continue;
    }

    if (/\s/.test(char)) {
      let end = index;
      while (end < source.length && /\s/.test(source[end]!)) end++;
      push(tokens, 'plain', source.slice(index, end));
      index = end;
      continue;
    }

    push(tokens, 'punct', char);
    index++;
  }
  return tokens;
}

export function highlightCss(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(--[\w-]+)|(#[\da-fA-F]{3,8}\b)|(@[\w-]+)|([\w-]+)(?=\s*:(?!:))|([.#]?[\w-]+(?:\[[^\]]*\])?)(?=[^{};]*\{)|(-?\d+(?:\.\d+)?(?:px|rem|em|%|ms|s)?)|([\s\S])/g;
  for (const match of source.matchAll(pattern)) {
    const [text, comment, string, variable, color, at, property, selector, number] = match;
    if (comment) push(tokens, 'comment', text);
    else if (string) push(tokens, 'string', text);
    else if (variable) push(tokens, 'attr', text);
    else if (color) push(tokens, 'number', text);
    else if (at) push(tokens, 'keyword', text);
    else if (property) push(tokens, 'property', text);
    else if (selector) push(tokens, 'tag', text);
    else if (number) push(tokens, 'number', text);
    else push(tokens, 'plain', text);
  }
  return tokens;
}

export function highlightShell(source: string): Token[] {
  const tokens: Token[] = [];
  for (const line of source.split(/(\n)/)) {
    if (line === '\n') push(tokens, 'plain', line);
    else if (line.trimStart().startsWith('#')) push(tokens, 'comment', line);
    else {
      const [command = '', ...rest] = line.split(/(\s+)/);
      push(tokens, 'function', command);
      for (const part of rest) push(tokens, /^-/.test(part) ? 'attr' : /^[@.\w/-]+\.(tgz|tsx?|css)$|^@/.test(part) ? 'string' : 'plain', part);
    }
  }
  return tokens;
}

export function highlight(source: string, language: Language): Token[] {
  if (language === 'css') return highlightCss(source);
  if (language === 'sh') return highlightShell(source);
  return highlightScript(source, language === 'tsx');
}
