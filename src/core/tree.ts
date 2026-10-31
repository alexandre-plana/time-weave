import type { TimelineRow } from './model.js';

export interface RowNode<RowMeta = unknown> {
  readonly row: TimelineRow<RowMeta>;
  readonly depth: number;
  readonly childIds: readonly string[];
}

export interface RowTree<RowMeta = unknown> {
  readonly roots: readonly string[];
  readonly nodes: ReadonlyMap<string, RowNode<RowMeta>>;
}

/** A row as displayed, after applying the expansion state. */
export interface VisibleRow<RowMeta = unknown> {
  readonly row: TimelineRow<RowMeta>;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
}

/** Builds the tree from rows already validated (no cycle, no missing parent). */
export function buildRowTree<RowMeta>(rows: readonly TimelineRow<RowMeta>[]): RowTree<RowMeta> {
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const row of rows) {
    if (row.parentId === undefined) roots.push(row.id);
    else {
      let list = children.get(row.parentId);
      if (!list) children.set(row.parentId, (list = []));
      list.push(row.id);
    }
  }
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  const nodes = new Map<string, RowNode<RowMeta>>();
  const visit = (id: string, depth: number): void => {
    const row = byId.get(id);
    if (!row) return;
    const childIds = children.get(id) ?? [];
    nodes.set(id, { row, depth, childIds });
    for (const child of childIds) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  return { roots, nodes };
}

export function flattenVisibleRows<RowMeta>(
  tree: RowTree<RowMeta>,
  expanded: ReadonlySet<string>,
): VisibleRow<RowMeta>[] {
  const result: VisibleRow<RowMeta>[] = [];
  const visit = (id: string): void => {
    const node = tree.nodes.get(id);
    if (!node) return;
    const hasChildren = node.childIds.length > 0;
    const isExpanded = hasChildren && expanded.has(id);
    result.push({ row: node.row, depth: node.depth, hasChildren, expanded: isExpanded });
    if (isExpanded) for (const child of node.childIds) visit(child);
  };
  for (const root of tree.roots) visit(root);
  return result;
}

/** Ids of all ancestors of `id`, nearest first. */
export function ancestorsOf(tree: RowTree<unknown>, id: string): string[] {
  const result: string[] = [];
  let parent = tree.nodes.get(id)?.row.parentId;
  while (parent !== undefined) {
    result.push(parent);
    parent = tree.nodes.get(parent)?.row.parentId;
  }
  return result;
}
