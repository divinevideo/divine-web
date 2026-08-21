import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const LOG_FUNCTIONS = new Set([
  'debugError',
  'debugLog',
  'debugWarn',
  'verboseLog',
]);
const IDENTIFIER_NAME = /(?:^|[._])(?:id|npub|pubkey)$|(?:Id|ID|Npub|Pubkey)$/;

type Violation = {
  column: number;
  file: string;
  line: number;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (['.ts', '.tsx'].includes(extname(path))) out.push(path);
  }
  return out;
}

function isLogCall(node: ts.CallExpression): boolean {
  if (ts.isIdentifier(node.expression)) return LOG_FUNCTIONS.has(node.expression.text);
  return ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === 'console';
}

function isIdentifierShortening(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  if (!['slice', 'substring'].includes(node.expression.name.text)) return false;
  if (node.arguments.length < 2 || node.arguments[0].getText() !== '0') return false;
  return IDENTIFIER_NAME.test(node.expression.expression.getText());
}

/**
 * An identifier only stands for a variable in some positions. In `video.id` and
 * `{ id: value }` the `id` names a property, so matching it against local
 * variables would blame an unrelated `const id` elsewhere in the file.
 */
function isValueReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) && parent.right === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  if (ts.isJsxAttribute(parent) && parent.name === node) return false;
  return true;
}

/** Nodes that hold their own `const`/`let` bindings. */
function isScope(node: ts.Node): boolean {
  return ts.isSourceFile(node)
    || ts.isBlock(node)
    || ts.isModuleBlock(node)
    || ts.isCaseBlock(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node);
}

export function findNostrIdLogTruncations(file: string, source: string): Violation[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const shortenedLocals = new Map<ts.Node, Map<string, ts.CallExpression>>();
  const violations = new Map<number, Violation>();

  const record = (node: ts.Node) => {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.set(node.getStart(sourceFile), {
      file,
      line: position.line + 1,
      column: position.character + 1,
    });
  };

  const enclosingScope = (node: ts.Node): ts.Node => {
    for (let current = node.parent; current; current = current.parent) {
      if (isScope(current)) return current;
    }
    return sourceFile;
  };

  const resolveShortening = (node: ts.Identifier): ts.CallExpression | undefined => {
    for (let current: ts.Node | undefined = node; current; current = current.parent) {
      if (!isScope(current)) continue;
      const shortening = shortenedLocals.get(current)?.get(node.text);
      if (shortening) return shortening;
    }
    return undefined;
  };

  const collectLocals = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const visitInitializer = (candidate: ts.Node) => {
        if (isIdentifierShortening(candidate)) {
          const scope = enclosingScope(node);
          const locals = shortenedLocals.get(scope) ?? new Map<string, ts.CallExpression>();
          locals.set(node.name.text, candidate);
          shortenedLocals.set(scope, locals);
        }
        ts.forEachChild(candidate, visitInitializer);
      };
      visitInitializer(node.initializer);
    }
    ts.forEachChild(node, collectLocals);
  };

  const inspectLogArgument = (node: ts.Node) => {
    if (isIdentifierShortening(node)) record(node);
    if (ts.isIdentifier(node) && isValueReference(node)) {
      const shortening = resolveShortening(node);
      if (shortening) record(shortening);
    }
    ts.forEachChild(node, inspectLogArgument);
  };

  const inspectLogs = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isLogCall(node)) {
      node.arguments.forEach(inspectLogArgument);
      return;
    }
    ts.forEachChild(node, inspectLogs);
  };

  collectLocals(sourceFile);
  inspectLogs(sourceFile);
  return [...violations.values()];
}

describe('Nostr identifier logging', () => {
  it('detects direct and nested truncation in log arguments', () => {
    const source = `
      debugLog(event.id.slice(0, 8));
      console.log(events.map((event) => ({ id: event.id.substring(0, 12) })));
    `;

    expect(findNostrIdLogTruncations('synthetic.ts', source)).toHaveLength(2);
  });

  it('detects a shortened identifier assigned before logging', () => {
    const source = `
      const preview = pubkey.slice(0, 8);
      debugLog('author', preview);
    `;

    expect(findNostrIdLogTruncations('synthetic.ts', source)).toHaveLength(1);
  });

  it('detects a shortened identifier logged from an inner scope', () => {
    const source = `
      const preview = pubkey.slice(0, 8);
      function report() {
        debugLog('author', preview);
      }
    `;

    expect(findNostrIdLogTruncations('synthetic.ts', source)).toHaveLength(1);
  });

  it('allows UI truncation, list sampling, and full identifier logs', () => {
    const source = `
      const label = event.id.slice(0, 8);
      const sample = pubkeys.slice(0, 5);
      debugLog(event.id, sample);
    `;

    expect(findNostrIdLogTruncations('synthetic.ts', source)).toEqual([]);
  });

  it('does not blame a UI truncation for a property that happens to share its name', () => {
    const source = `
      const id = event.id.slice(0, 8);
      const pubkey = author.pubkey.slice(0, 8);
      debugLog(video.id, event.pubkey);
      debugLog(\`ev=\${video.id}\`);
      debugLog({ id: video.id });
    `;

    expect(findNostrIdLogTruncations('synthetic.ts', source)).toEqual([]);
  });

  it('does not blame a UI truncation for a same-named variable in another scope', () => {
    const source = `
      function Badge({ event }) {
        const label = event.id.slice(0, 8);
        return label;
      }
      function announce(text) {
        const label = text.toUpperCase();
        debugLog('label', label);
      }
    `;

    expect(findNostrIdLogTruncations('synthetic.ts', source)).toEqual([]);
  });

  it('keeps source logging free of shortened Nostr identifiers', () => {
    const violations = walk('src').flatMap((file) =>
      findNostrIdLogTruncations(file, readFileSync(file, 'utf8')),
    );

    expect(violations).toEqual([]);
  });
});
