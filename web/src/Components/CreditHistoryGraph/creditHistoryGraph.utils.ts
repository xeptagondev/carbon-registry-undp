import { addCommSep } from "../../Definitions/Definitions/programme.definitions";
import { CreditBlockHistoryActionInfo, CreditHistoryEntry, HistoryTreeNode } from "./creditHistoryGraph.types";

let counter = 0;
const nextId = () => `n${counter++}`;

/** Node's display note from its action info — no range (the node shows it). */
export const formatActionNote = (info: CreditBlockHistoryActionInfo): string => {
  const amount = addCommSep(String(info.amount));
  switch (info.action) {
    case "ISSUE":
      return `Issued ${amount} to ${info.companyName}`;
    case "RETAIN":
      return `Retain ${amount} by ${info.companyName}`;
    case "TRANSFER":
      return `Transferred ${amount} to ${info.companyName}`;
    case "RETIRE":
      return `Retired ${amount} by ${info.companyName}`;
    default:
      return info.action;
  }
};

/**
 * Builds the tree from getCreditBlockHistoryTree's flat entry list. Entry 0 is
 * the root (issuance, carrying `info`); every later entry attaches its
 * `children` onto the node matching its `range`.
 */
export const buildHistoryTree = (entries: CreditHistoryEntry[]): HistoryTreeNode | null => {
  if (!entries || entries.length === 0) return null;
  counter = 0;

  // Company carried alongside `note` so a view can link it without re-parsing.
  const noteCompany = (info: CreditBlockHistoryActionInfo) => ({ companyId: info.companyId, companyName: info.companyName });

  const rootInfo = entries[0].info;
  const root: HistoryTreeNode = {
    id: nextId(),
    range: entries[0].range,
    note: rootInfo ? formatActionNote(rootInfo) : undefined,
    updateTime: rootInfo?.timestamp,
    ...(rootInfo ? noteCompany(rootInfo) : {}),
    label: entries[0].range,
    depth: 0,
    children: [],
    parent: null,
  };
  const nodesByRange: Record<string, HistoryTreeNode> = { [entries[0].range]: root };

  const makeNode = (range: string, info: CreditBlockHistoryActionInfo, parent: HistoryTreeNode): HistoryTreeNode => {
    const note = formatActionNote(info);
    return {
      id: nextId(),
      range,
      note,
      updateTime: info.timestamp,
      ...noteCompany(info),
      label: note,
      depth: parent.depth + 1,
      children: [],
      parent,
    };
  };

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const parent = nodesByRange[entry.range] || root;
    (entry.children ?? []).forEach((c) => {
      const node = makeNode(c.range, c.info, parent);
      parent.children.push(node);
      nodesByRange[c.range] = node;
    });
  }

  return root;
};

export const effectiveChildren = (node: HistoryTreeNode, collapsed: Set<string>): HistoryTreeNode[] =>
  collapsed.has(node.id) ? [] : node.children;

export const getPathToRoot = (node: HistoryTreeNode): Set<string> => {
  const path = new Set<string>();
  let cur: HistoryTreeNode | null = node;
  while (cur) {
    path.add(cur.id);
    cur = cur.parent;
  }
  return path;
};

/** Deepest last-child chain — used as the default selected node so the
 * graph opens already tracing the most recent history. */
export const findDefaultTarget = (node: HistoryTreeNode): HistoryTreeNode => {
  let last = node;
  node.children.forEach((c) => {
    last = findDefaultTarget(c);
  });
  return last;
};

// Post-order (children first) so when a range repeats along a lineage the
// deepest — most recent — node wins, not an earlier split marker.
export const findNodeByRange = (root: HistoryTreeNode, range: string): HistoryTreeNode | null => {
  for (const child of root.children) {
    const found = findNodeByRange(child, range);
    if (found) return found;
  }
  return root.range === range ? root : null;
};

/** Collapse every node not on the path to `target` — side-branches stay
 * present but collapsed. Used to scope a view to one block's lineage. */
export const collapseAllExceptPath = (root: HistoryTreeNode, target: HistoryTreeNode | null): Set<string> => {
  const collapsed = new Set<string>();
  const keep = target ? getPathToRoot(target) : new Set<string>([root.id]);
  const walk = (node: HistoryTreeNode) => {
    if (node.children.length) {
      if (!keep.has(node.id)) {
        collapsed.add(node.id);
        return;
      }
    }
    node.children.forEach(walk);
  };
  walk(root);
  return collapsed;
};

/** Collapse every node at depth 3+ by default, except along the path to
 * `target` (kept expanded so the default selection is visible). */
export const defaultCollapse = (root: HistoryTreeNode, target: HistoryTreeNode | null): Set<string> => {
  const collapsed = new Set<string>();
  const keep = target ? getPathToRoot(target) : null;
  const walk = (node: HistoryTreeNode) => {
    if (node.children.length) {
      if (keep ? !keep.has(node.id) : node.depth === 3) {
        collapsed.add(node.id);
        return;
      }
    }
    node.children.forEach(walk);
  };
  walk(root);
  return collapsed;
};

// Must match NoteText's font (TimelineGraphView.tsx) — canvas.measureText is
// how fitGraphToScreen learns the note's real width (it overflows the node).
const NOTE_FONT = "400 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
const NOTE_GAP = 25;

let measureCtx: CanvasRenderingContext2D | null | undefined;
const getMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (measureCtx === undefined) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
};

/** Rendered width (+ leading gap) of a Timeline note, or 0 if none. */
export const measureNoteWidth = (note?: string): number => {
  if (!note || !note.trim()) return 0;
  const ctx = getMeasureCtx();
  if (!ctx) return 0;
  ctx.font = NOTE_FONT;
  return ctx.measureText(note).width + NOTE_GAP;
};

/**
 * Whether every rendered node has real (non-zero) dimensions.
 * `useNodesInitialized()` can flip true a frame before that's actually so, so
 * one-shot fits poll this to fit from the same dimensions a later fit would.
 */
export const areNodesMeasured = (nodes: { width?: number | null; height?: number | null }[]): boolean =>
  nodes.length > 0 && nodes.every((n) => (n.width ?? 0) > 0 && (n.height ?? 0) > 0);

/** Cubic ease-out, for the path-highlight reveal. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Lerp between two "#rrggbb" colors — animates an edge's gray→blue stroke. */
export const mixHexColor = (from: string, to: string, t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  const [r0, g0, b0] = hexToRgb(from);
  const [r1, g1, b1] = hexToRgb(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * clamped);
  return `rgb(${mix(r0, r1)}, ${mix(g0, g1)}, ${mix(b0, b1)})`;
};

/**
 * Progress (0–1) of one edge's reveal given the overall path progress — the
 * chain is split into equal per-edge segments revealed strictly in order.
 * `segmentIndex` 0-based (root edge = 0); `totalSegments` = path length - 1.
 */
export const pathSegmentProgress = (segmentIndex: number, totalSegments: number, overallProgress: number): number => {
  if (totalSegments <= 0) return 1;
  const segStart = segmentIndex / totalSegments;
  const segEnd = (segmentIndex + 1) / totalSegments;
  const segT = Math.max(0, Math.min(1, (overallProgress - segStart) / (segEnd - segStart)));
  return easeOutCubic(segT);
};

// Fixed clearance reserved when fitting so content doesn't tuck under the
// floating mode-toggle (top-left) / vertical toolbar (top-right). Shared by
// every fitGraphToScreen call site so the two never drift out of sync again.
export const FIT_EXTRA_TOP = 40;
export const FIT_EXTRA_RIGHT_TOOLBAR = 60;

interface FitGraphNode {
  id: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
}

interface FitGraphBoundsOptions<N extends FitGraphNode> {
  /** Extra width past a node's measured right edge — for Timeline's note text,
   * which overflows the node and is invisible to React Flow's measurement.
   * Omit for Binary Tree. */
  getExtraRight?: (node: N) => number;
  /** Top padding so content clears the floating mode-toggle / toolbar. */
  extraTop?: number;
  /** Fixed right gap reserved for the floating (vertical) toolbar. */
  extraRight?: number;
  padding?: number;
  duration?: number;
  /** Only nodes passing this contribute to the bounds (e.g. Explorer's
   * path-only initial fit). Defaults to every node. */
  filter?: (node: N) => boolean;
}

/**
 * Fits the graph from the real rendered node boxes (`getNodes()`) rather than
 * `fitView()`, which misses overflowing content (Timeline notes) and the
 * floating toolbar corners. Shared by the fit button, initial-view effect,
 * and reset.
 */
export const fitGraphToScreen = <N extends FitGraphNode>(
  getNodes: () => N[],
  fitBounds: (
    bounds: { x: number; y: number; width: number; height: number },
    options?: { padding?: number; duration?: number }
  ) => void,
  options: FitGraphBoundsOptions<N> = {}
): void => {
  const allNodes = getNodes();
  const nodes = options.filter ? allNodes.filter(options.filter) : allNodes;
  if (!nodes.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    const w = n.width ?? 0;
    const h = n.height ?? 0;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  });

  // Overflowing note text — measured across *every* node, not just the
  // filtered set, since an excluded off-path sibling on the same row can
  // still have the longest note and would otherwise clip at the edge.
  if (options.getExtraRight) {
    allNodes.forEach((n) => {
      const extraRight = options.getExtraRight!(n);
      if (extraRight > 0) {
        maxX = Math.max(maxX, n.position.x + (n.width ?? 0) + extraRight);
      }
    });
  }

  const extraTop = options.extraTop ?? 0;
  const extraRight = options.extraRight ?? 0;
  fitBounds(
    { x: minX, y: minY - extraTop, width: maxX - minX + extraRight, height: maxY - minY + extraTop },
    { padding: options.padding ?? 0.15, duration: options.duration ?? 300 }
  );
};

/**
 * Wraps `fitBounds` so its fit never zooms past `maxZoom`, by tightening the
 * flow's own scale-extent (`setMaxZoom`) for the animation then restoring it
 * to `restoreMaxZoom` — clamping in one animation instead of fit-then-snap.
 * No-op when `maxZoom` is undefined (only the fullscreen tab sets one).
 */
export const withFitMaxZoom = (
  fitBounds: (
    bounds: { x: number; y: number; width: number; height: number },
    options?: { padding?: number; duration?: number }
  ) => void,
  setMaxZoom: (zoom: number) => void,
  maxZoom: number | undefined,
  restoreMaxZoom: number
): typeof fitBounds => {
  if (maxZoom === undefined) return fitBounds;
  return (bounds, options) => {
    setMaxZoom(maxZoom);
    fitBounds(bounds, options);
    setTimeout(() => setMaxZoom(restoreMaxZoom), options?.duration ?? 300);
  };
};
