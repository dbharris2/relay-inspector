/**
 * Pure reducer functions for the inspector's per-env tab state.
 *
 * Mirrors VSCode's preview-tab model plus a navigation history
 * (cmd-[ / cmd-] back/forward). Closed tabs stay in history and
 * reopen as preview when navigated back to.
 *
 * Every operation returns the same `TabState` reference when nothing
 * actually changes, so useState (and downstream useMemo deps) can
 * short-circuit re-renders. Tests in tabReducer.test.ts exercise the
 * no-op cases explicitly.
 *
 * Invariants:
 *   - previewTabId, if non-null, is in tabIds.
 *   - activeTabId, if non-null, is in tabIds.
 *   - 0 <= historyPos < history.length, or historyPos === -1 when
 *     history is empty.
 */

export type TabState = {
  readonly tabIds: readonly string[];
  readonly previewTabId: string | null;
  readonly activeTabId: string | null;
  readonly history: readonly string[];
  /** Index into `history`, or -1 when history is empty. */
  readonly historyPos: number;
};

export const EMPTY_TABS: TabState = {
  tabIds: [],
  previewTabId: null,
  activeTabId: null,
  history: [],
  historyPos: -1,
};

/**
 * Append `id` to history at the current position, truncating any
 * forward entries past it (standard browser behavior). No-op when id
 * already equals the current entry.
 */
function pushHistory(s: TabState, id: string): TabState {
  if (s.historyPos >= 0 && s.history[s.historyPos] === id) return s;
  const trimmed = s.history.slice(0, s.historyPos + 1);
  return {
    ...s,
    history: [...trimmed, id],
    historyPos: trimmed.length,
  };
}

/**
 * Make sure `id` has a tab. If it doesn't, reopen it as preview,
 * replacing the existing preview slot if any. Used by back/forward to
 * re-materialize tabs the user previously closed.
 */
function ensureTabFor(s: TabState, id: string): TabState {
  if (s.tabIds.includes(id)) return s;
  if (s.previewTabId != null) {
    return {
      ...s,
      tabIds: s.tabIds.map((x) => (x === s.previewTabId ? id : x)),
      previewTabId: id,
    };
  }
  return {
    ...s,
    tabIds: [...s.tabIds, id],
    previewTabId: id,
  };
}

/**
 * Open or activate a record as a tab.
 *
 *   - `asPreview` true (default): if the record isn't open, opens it
 *     in the preview slot, replacing any existing preview. If it is
 *     open, just activates it.
 *   - `asPreview` false: opens or activates as a pinned (non-preview)
 *     tab. If the record is currently the preview, promotes it to
 *     pinned by clearing the preview slot.
 *
 * Pushes the record onto history, truncating forward entries past
 * the current position.
 */
export function openRecord(
  s: TabState,
  id: string,
  asPreview = true,
): TabState {
  const isOpen = s.tabIds.includes(id);
  let next: TabState;
  if (isOpen) {
    const previewTabId =
      !asPreview && s.previewTabId === id ? null : s.previewTabId;
    if (s.activeTabId === id && previewTabId === s.previewTabId) {
      // Already active, no preview-status change → nothing changed.
      // Skip history push too (re-clicking the current tab isn't a
      // distinct navigation).
      return s;
    }
    next = { ...s, activeTabId: id, previewTabId };
  } else if (asPreview && s.previewTabId != null) {
    // Replace the existing preview slot in place.
    next = {
      ...s,
      tabIds: s.tabIds.map((x) => (x === s.previewTabId ? id : x)),
      previewTabId: id,
      activeTabId: id,
    };
  } else {
    next = {
      ...s,
      tabIds: [...s.tabIds, id],
      previewTabId: asPreview ? id : s.previewTabId,
      activeTabId: id,
    };
  }
  return pushHistory(next, id);
}

/**
 * Activate an existing tab. Pushes to history. No-op if `id` isn't
 * currently open, or is already the active tab.
 */
export function activateTab(s: TabState, id: string): TabState {
  if (!s.tabIds.includes(id)) return s;
  if (s.activeTabId === id) return s;
  return pushHistory({ ...s, activeTabId: id }, id);
}

/**
 * Promote the preview tab to pinned. No-op if `id` isn't currently
 * the preview. Doesn't touch history (this is a metadata change, not
 * a navigation).
 */
export function pinTab(s: TabState, id: string): TabState {
  if (s.previewTabId !== id) return s;
  return { ...s, previewTabId: null };
}

/**
 * Close a tab. If the closed tab was active, picks the adjacent tab
 * to its right (falling back to the left, or null when no tabs
 * remain).
 *
 * Doesn't push to history (closing is destructive, not a navigation)
 * and deliberately keeps history entries for the closed id — back can
 * still navigate to it and reopen it as preview.
 */
export function closeTab(s: TabState, id: string): TabState {
  const idx = s.tabIds.indexOf(id);
  if (idx === -1) return s;
  const tabIds = s.tabIds.filter((x) => x !== id);
  const previewTabId = s.previewTabId === id ? null : s.previewTabId;
  const activeTabId =
    s.activeTabId === id
      ? (tabIds[idx] ?? tabIds[idx - 1] ?? null)
      : s.activeTabId;
  return { ...s, tabIds, previewTabId, activeTabId };
}

/**
 * Step back one entry in history. Activates the target tab; if it
 * had been closed, reopens it as preview (replacing the current
 * preview slot, if any). No-op at the start of history.
 */
export function goBack(s: TabState): TabState {
  if (s.historyPos <= 0) return s;
  const pos = s.historyPos - 1;
  const target = s.history[pos]!;
  return { ...ensureTabFor(s, target), activeTabId: target, historyPos: pos };
}

/**
 * Step forward one entry in history. Symmetric to goBack. No-op at
 * the end of history.
 */
export function goForward(s: TabState): TabState {
  if (s.historyPos >= s.history.length - 1) return s;
  const pos = s.historyPos + 1;
  const target = s.history[pos]!;
  return { ...ensureTabFor(s, target), activeTabId: target, historyPos: pos };
}
