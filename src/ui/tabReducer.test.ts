import { describe, expect, it } from 'vitest';
import {
  EMPTY_TABS,
  activateTab,
  closeTab,
  goBack,
  goForward,
  openRecord,
  pinTab,
  type TabState,
} from './tabReducer';

/**
 * Helper: assert the state is internally consistent. Run after every
 * transition the tests care about so we catch invariant breaks even
 * if the assertions for the transition itself don't cover them.
 */
function expectInvariants(s: TabState) {
  if (s.previewTabId != null) {
    expect(s.tabIds).toContain(s.previewTabId);
  }
  if (s.activeTabId != null) {
    expect(s.tabIds).toContain(s.activeTabId);
  }
  if (s.history.length === 0) {
    expect(s.historyPos).toBe(-1);
  } else {
    expect(s.historyPos).toBeGreaterThanOrEqual(0);
    expect(s.historyPos).toBeLessThan(s.history.length);
  }
}

describe('openRecord', () => {
  it('opens a record as a preview tab when none exist', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    expect(s.tabIds).toEqual(['A']);
    expect(s.previewTabId).toBe('A');
    expect(s.activeTabId).toBe('A');
    expect(s.history).toEqual(['A']);
    expect(s.historyPos).toBe(0);
    expectInvariants(s);
  });

  it('replaces the existing preview when a different record is opened as preview', () => {
    const s = openRecord(openRecord(EMPTY_TABS, 'A'), 'B');
    expect(s.tabIds).toEqual(['B']);
    expect(s.previewTabId).toBe('B');
    expect(s.activeTabId).toBe('B');
    expect(s.history).toEqual(['A', 'B']);
    expect(s.historyPos).toBe(1);
    expectInvariants(s);
  });

  it('appends a pinned tab alongside the preview', () => {
    const after = openRecord(openRecord(EMPTY_TABS, 'A'), 'B', false);
    expect(after.tabIds).toEqual(['A', 'B']);
    expect(after.previewTabId).toBe('A');
    expect(after.activeTabId).toBe('B');
    expectInvariants(after);
  });

  it('opens the first tab as pinned when asPreview=false', () => {
    const s = openRecord(EMPTY_TABS, 'A', false);
    expect(s.tabIds).toEqual(['A']);
    expect(s.previewTabId).toBeNull();
    expect(s.activeTabId).toBe('A');
    expectInvariants(s);
  });

  it('activates an already-open pinned tab without changing preview', () => {
    // Open A pinned, B as preview, then click A again.
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B');
    const after = openRecord(s, 'A');
    expect(after.previewTabId).toBe('B');
    expect(after.activeTabId).toBe('A');
    expectInvariants(after);
  });

  it('promotes the preview to pinned when reopened with asPreview=false', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    expect(s.previewTabId).toBe('A');
    const after = openRecord(s, 'A', false);
    expect(after.previewTabId).toBeNull();
    expect(after.tabIds).toEqual(['A']);
    expect(after.activeTabId).toBe('A');
    expectInvariants(after);
  });

  it('returns the same reference when called on an already-active record with same preview status', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = openRecord(s, 'A');
    expect(after).toBe(s);
  });

  it('truncates forward history when a new navigation happens after going back', () => {
    let s = EMPTY_TABS;
    s = openRecord(s, 'A');
    s = openRecord(s, 'B');
    s = openRecord(s, 'C');
    s = goBack(s); // now at B
    expect(s.history).toEqual(['A', 'B', 'C']);
    expect(s.historyPos).toBe(1);
    const after = openRecord(s, 'D');
    // forward (C) is gone; D took its slot
    expect(after.history).toEqual(['A', 'B', 'D']);
    expect(after.historyPos).toBe(2);
    expectInvariants(after);
  });

  it('does not push duplicate consecutive entries when re-opening the current record', () => {
    const s = openRecord(openRecord(EMPTY_TABS, 'A'), 'B');
    expect(s.history).toEqual(['A', 'B']);
    const after = openRecord(s, 'B');
    expect(after).toBe(s);
  });
});

describe('activateTab', () => {
  it('changes the active tab and pushes to history', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    // active is B; switch back to A
    const after = activateTab(s, 'A');
    expect(after.activeTabId).toBe('A');
    expect(after.history).toEqual(['A', 'B', 'A']);
    expect(after.historyPos).toBe(2);
    expectInvariants(after);
  });

  it('is a no-op when the target is already active', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = activateTab(s, 'A');
    expect(after).toBe(s);
  });

  it('is a no-op when the target tab is not open', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = activateTab(s, 'Z');
    expect(after).toBe(s);
  });
});

describe('pinTab', () => {
  it('clears previewTabId when pinning the current preview', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = pinTab(s, 'A');
    expect(after.previewTabId).toBeNull();
    expect(after.tabIds).toEqual(['A']);
    expectInvariants(after);
  });

  it('is a no-op when the target is not the preview', () => {
    const s = openRecord(openRecord(EMPTY_TABS, 'A', false), 'B');
    // preview is B; try to pin A
    const after = pinTab(s, 'A');
    expect(after).toBe(s);
  });

  it('does not change history', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = pinTab(s, 'A');
    expect(after.history).toEqual(s.history);
    expect(after.historyPos).toBe(s.historyPos);
  });
});

describe('closeTab', () => {
  it('removes the tab and falls back to the tab on its right', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    s = openRecord(s, 'C', false);
    s = activateTab(s, 'B'); // active is B
    const after = closeTab(s, 'B');
    expect(after.tabIds).toEqual(['A', 'C']);
    expect(after.activeTabId).toBe('C');
    expectInvariants(after);
  });

  it('falls back to the tab on the left when closing the rightmost active tab', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    const after = closeTab(s, 'B');
    expect(after.tabIds).toEqual(['A']);
    expect(after.activeTabId).toBe('A');
    expectInvariants(after);
  });

  it('sets activeTabId to null when closing the only open tab', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = closeTab(s, 'A');
    expect(after.tabIds).toEqual([]);
    expect(after.activeTabId).toBeNull();
    expect(after.previewTabId).toBeNull();
    expectInvariants(after);
  });

  it('clears previewTabId when closing the preview', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = closeTab(s, 'A');
    expect(after.previewTabId).toBeNull();
  });

  it('keeps history entries for closed tabs so back can reopen them', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    const after = closeTab(s, 'B');
    // B is gone from tabs but still in history.
    expect(after.tabIds).toEqual(['A']);
    expect(after.history).toEqual(['A', 'B']);
    expect(after.historyPos).toBe(1);
    expectInvariants(after);
  });

  it('does not push to history', () => {
    const s = openRecord(openRecord(EMPTY_TABS, 'A', false), 'B', false);
    const after = closeTab(s, 'A');
    expect(after.history).toEqual(s.history);
    expect(after.historyPos).toBe(s.historyPos);
  });

  it('is a no-op when the target tab is not open', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = closeTab(s, 'Z');
    expect(after).toBe(s);
  });

  it('leaves activeTabId alone when closing an inactive tab', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    // active is B
    const after = closeTab(s, 'A');
    expect(after.activeTabId).toBe('B');
    expect(after.tabIds).toEqual(['B']);
  });
});

describe('goBack / goForward', () => {
  it('moves position back one step in history', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    const after = goBack(s);
    expect(after.activeTabId).toBe('A');
    expect(after.historyPos).toBe(0);
    expect(after.history).toEqual(['A', 'B']);
    expectInvariants(after);
  });

  it('does not touch history when navigating back', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    const after = goBack(s);
    expect(after.history).toEqual(s.history);
  });

  it('is a no-op at the start of history', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    const after = goBack(s);
    expect(after).toBe(s);
  });

  it('is a no-op at the end of history', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    // at the end already
    const after = goForward(s);
    expect(after).toBe(s);
  });

  it('goes forward after going back', () => {
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B', false);
    s = goBack(s); // at A
    const after = goForward(s);
    expect(after.activeTabId).toBe('B');
    expect(after.historyPos).toBe(1);
    expectInvariants(after);
  });

  it('reopens a closed record as preview when navigated back to', () => {
    // Open A pinned, B preview. Close B. Walk back to B via history.
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B');
    s = closeTab(s, 'B');
    // B is gone but still in history.
    expect(s.tabIds).toEqual(['A']);
    expect(s.history).toEqual(['A', 'B']);
    expect(s.historyPos).toBe(1);
    const after = goBack(s);
    expect(after.activeTabId).toBe('A');
    expect(after.historyPos).toBe(0);
    // Going forward should re-materialize B as a preview tab.
    const back = goForward(after);
    expect(back.activeTabId).toBe('B');
    expect(back.tabIds).toContain('B');
    expect(back.previewTabId).toBe('B');
    expectInvariants(back);
  });

  it('replaces the existing preview slot when reopening a closed tab via history', () => {
    // Open B preview, then open C preview (replaces B); now go back
    // twice (through history A → B → C). After two backs we should be
    // at A; B should have been reopened in the preview slot at some
    // point.
    let s = openRecord(EMPTY_TABS, 'A', false);
    s = openRecord(s, 'B'); // tabIds: [A, B], preview: B
    s = openRecord(s, 'C'); // tabIds: [A, C], preview: C (B replaced)
    expect(s.tabIds).toEqual(['A', 'C']);
    expect(s.history).toEqual(['A', 'B', 'C']);

    // Go back to B — must reopen as preview, replacing C.
    const back1 = goBack(s);
    expect(back1.activeTabId).toBe('B');
    expect(back1.previewTabId).toBe('B');
    expect(back1.tabIds).toContain('B');
    expect(back1.tabIds).not.toContain('C');
    expectInvariants(back1);
  });
});

describe('reference equality', () => {
  it('returns the same reference for every no-op transition', () => {
    const s = openRecord(EMPTY_TABS, 'A');
    expect(activateTab(s, 'A')).toBe(s);
    expect(pinTab(s, 'B')).toBe(s); // B isn't preview
    expect(closeTab(s, 'Z')).toBe(s); // Z isn't open
    expect(goForward(s)).toBe(s); // at end
    expect(openRecord(s, 'A')).toBe(s); // already active
  });
});
