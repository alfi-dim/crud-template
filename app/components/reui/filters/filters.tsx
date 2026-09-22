"use client";

import * as React from "react";
import { FiltersBuilder } from "~/components/reui/filters/filters-builder";
import { FilterChip } from "~/components/reui/filters/filters-chip";
import {
  createFilterFocusStore,
  createFilterResolutionStore,
  FilterActionsContext,
  filterControlSizes,
  FilterFocusContext,
  filterReadOnlyProps,
  FilterRenderContext,
  FilterStateContext,
  isFilterLocked,
  useFilterActions,
  useFilterFocusStore,
  useFilterState,
  type FilterActionsContextValue,
} from "~/components/reui/filters/filters-context";
import {
  filterDraftReducer,
  isFilterDraftCommittable,
  type FilterDraftAction,
} from "~/components/reui/filters/filters-draft";
import {
  DEFAULT_FILTER_EDITORS,
  resolveFilterEditor,
  type FilterEditorRegistry,
} from "~/components/reui/filters/filters-editors";
import { resolveFilterLabels } from "~/components/reui/filters/filters-i18n";
import {
  buildFilterIndex,
  createFilterIdFactory,
  findFilterSchemaIssues,
  getFilterField,
  warnFilterOnce,
  type FilterPathCollapse,
} from "~/components/reui/filters/filters-lib";
import {
  createFilterOperators,
  DEFAULT_FILTER_OPERATOR_LABELS,
  DEFAULT_FILTER_OPERATORS,
  getFilterOperator,
  negateFilterOperator,
  operatorTakesValue,
  resolveFilterOperators,
  type FilterOperatorLabels,
} from "~/components/reui/filters/filters-operators";
import {
  clearFilterQuery,
  countFilterRules,
  createFilterQuery,
  createFilterRule,
  duplicateFilterNode,
  findFilterNode,
  findFilterRule,
  flattenFilterRules,
  insertFilterNode,
  removeFilterNode,
  updateFilterRule,
} from "~/components/reui/filters/filters-query";
import type {
  FilterChangeDetails,
  FilterDraft,
  FilterEditor,
  FilterField,
  FilterLabels,
  FilterQuery,
  FilterRule,
  FilterValueDisplayContext,
} from "~/components/reui/filters/filters-types";
import { cva } from "class-variance-authority";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

/* -------------------------------------------------------------------------- */
/*                                  Variants                                  */
/* -------------------------------------------------------------------------- */

const filtersBarVariants = cva("flex flex-wrap items-center", {
  variants: {
    // The rungs `FILTER_CONTROL_SIZES` holds, fed the RESOLVED rung at both
    // call sites, which is what keeps the two ladders in step: a cva default
    // only applies to a value nobody passed, so a raw `"lg"` reaching here
    // would leave the bar with no gap at all.
    size: {
      sm: "gap-1.5",
      default: "gap-2",
    },
  },
  defaultVariants: { size: "default" },
});

/* -------------------------------------------------------------------------- */
/*                                 Controllable                               */
/* -------------------------------------------------------------------------- */

function useControllableQuery<V, O>(
  controlled: FilterQuery<V> | undefined,
  uncontrolledDefault: FilterQuery<V> | undefined,
  onChange: ((query: FilterQuery<V>, details: FilterChangeDetails<V, O>) => void) | undefined,
) {
  const isControlled = controlled !== undefined;
  const [internal, setInternal] = React.useState<FilterQuery<V>>(
    () => uncontrolledDefault ?? createFilterQuery<V>(),
  );

  const query = isControlled ? controlled : internal;
  const queryRef = React.useRef(query);
  React.useEffect(() => {
    queryRef.current = query;
  });

  const setQuery = React.useCallback(
    (next: FilterQuery<V>, details: FilterChangeDetails<V, O>) => {
      if (next === queryRef.current) return;
      queryRef.current = next;
      if (!isControlled) setInternal(next);
      onChange?.(next, details);
    },
    [isControlled, onChange],
  );

  return { query, queryRef, setQuery };
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

export interface FiltersProps<V = unknown, O = unknown> {
  /** The field schema. Nested via each field's own `fields`. */
  fields: readonly FilterField<V, O>[];

  query?: FilterQuery<V>;
  defaultQuery?: FilterQuery<V>;
  onQueryChange?: (query: FilterQuery<V>, details: FilterChangeDetails<V, O>) => void;

  labels?: Partial<FilterLabels>;
  /** Operator wording, overridden independently of the chrome copy. */
  operatorLabels?: FilterOperatorLabels;
  /** Extra or replacement value editors, resolved by a field's `editor` name. */
  editors?: FilterEditorRegistry;

  /**
   * The density of the whole bar, chips included. TWO RUNGS and no `lg`,
   * resolved through `filterControlSizes` to whatever the ACTIVE STYLE calls
   * that rung (nova 7/8, sera 9/10, mira 6/7, maia and luma 8/9, lyra and rhea
   * 7/8, vega 8/9). Chips need no `ButtonGroup` variant: `items-stretch` gives
   * the pill the height of its one definite-height child, the kebab.
   */
  size?: "sm" | "default";
  disabled?: boolean;
  readOnly?: boolean;

  /**
   * ONE VETO POINT for every change the BAR makes to the query, and only those.
   * Return `false` to refuse; anything else commits, and `details.reason` names
   * the action. One hook rather than one per control because every write goes
   * through `emit`. It can only refuse, and it sits BEHIND the lock, so a locked
   * bar never asks it. Returning a
   * REPLACEMENT tree was rejected: the announcement is already computed from
   * the proposed tree, so the bar would say one thing and commit another.
   */
  onBeforeQueryChange?: (
    query: FilterQuery<V>,
    details: FilterChangeDetails<V, O>,
  ) => boolean | void;

  /**
   * Classes for the dropdown MENUS and the field PICKER panel, one prop each
   * rather than one per mount point. Merged after the default, so `w-*` wins.
   */
  menuClassName?: string;
  fieldPickerClassName?: string;

  /**
   * How a NESTED attribute path is shortened when too deep to read. `"none"` is
   * the default, so an upgrade changes nothing under a consumer; the collapser
   * is the cascader's, and the full path survives as the accessible NAME.
   */
  pathCollapse?: FilterPathCollapse;
  /**
   * How many names survive the collapse, the elided run not counted. Inert
   * while `pathCollapse` is `"none"`. Three is the cascader's own default.
   */
  maxPathSegments?: number;

  /** Replaces the default Add filter button. */
  trigger?: React.ReactNode;
  /** Renders a Clear button once the query holds anything. */
  showClear?: boolean;

  renderValue?: (context: FilterValueDisplayContext<V, O>) => React.ReactNode;
  renderChip?: (rule: FilterRule<V>) => React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function Filters<V = unknown, O = unknown>({
  fields,
  query: controlledQuery,
  defaultQuery,
  onQueryChange,
  labels: labelsProp,
  operatorLabels: operatorLabelsProp,
  editors: editorsProp,
  size = "default",
  disabled = false,
  readOnly = false,
  onBeforeQueryChange,
  menuClassName,
  fieldPickerClassName,
  pathCollapse = "none",
  maxPathSegments = 3,
  trigger,
  showClear = false,
  renderValue,
  renderChip,
  className,
  children,
}: Readonly<FiltersProps<V, O>>) {
  const { query, queryRef, setQuery } = useControllableQuery<V, O>(
    controlledQuery,
    defaultQuery,
    onQueryChange,
  );

  const [draft, dispatchDraftRaw] = React.useReducer(
    filterDraftReducer<V>,
    null as FilterDraft<V> | null,
  );
  // Text AND a counter: `aria-live` fires on a DOM mutation and React writes
  // nothing when the string is already there, so a repeat was silent. Measured
  // with a MutationObserver: the same count three times, one mutation.
  const [announced, setAnnounced] = React.useState({ seq: 0, text: "" });
  const announcement = announced.text;
  const setAnnouncement = React.useCallback((text: string) => {
    setAnnounced((prev) => ({ seq: prev.seq + 1, text }));
  }, []);

  // Seeded from useId: ids from Date.now() plus Math.random() broke hydration.
  const idSeed = React.useId();
  const nextId = React.useMemo(() => createFilterIdFactory(`${idSeed}f`), [idSeed]);

  const focusStore = React.useMemo(() => createFilterFocusStore(), []);
  // One per root: the value-to-label store every `useFilterOptions` shares.
  const resolutionStore = React.useMemo(() => createFilterResolutionStore(), []);

  /* -------------------------------- derived ------------------------------- */

  // Field callbacks and configuration must refresh with the supplied fields.
  // Consumers can memoize expensive field arrays to avoid rebuilding the index.
  const index = React.useMemo(() => buildFilterIndex<V, O>(fields), [fields]);

  const labels = React.useMemo(() => resolveFilterLabels(labelsProp), [labelsProp]);

  const operatorCatalog = React.useMemo(() => {
    if (!operatorLabelsProp) return DEFAULT_FILTER_OPERATORS;
    return createFilterOperators({
      ...DEFAULT_FILTER_OPERATOR_LABELS,
      ...operatorLabelsProp,
    });
  }, [operatorLabelsProp]);

  const editors = React.useMemo(
    () => ({ ...DEFAULT_FILTER_EDITORS, ...editorsProp }),
    [editorsProp],
  );

  const resolveOperators = React.useCallback(
    (field: FilterField<V, O>) => resolveFilterOperators(field, operatorCatalog),
    [operatorCatalog],
  );

  const ruleCount = React.useMemo(() => countFilterRules(query), [query]);

  /* --------------------------- latest-props ref --------------------------- */

  const latest = React.useRef({
    index,
    labels,
    operatorCatalog,
    resolveOperators,
    nextId,
    setQuery,
    queryRef,
    disabled,
    readOnly,
    onBeforeQueryChange,
  });
  React.useEffect(() => {
    latest.current = {
      index,
      labels,
      operatorCatalog,
      resolveOperators,
      nextId,
      setQuery,
      queryRef,
      disabled,
      readOnly,
      onBeforeQueryChange,
    };
  });

  /* -------------------------------- actions ------------------------------- */

  // Every mutator below reads state through `latest`, so no keystroke rebuilds
  // one. The lock flags are the ONE exception, for the reason on `locked`.

  /**
   * THE MUTATION BOUNDARY, asked here and not at each control, because the
   * routes into a query are not only buttons. It needs BOTH the closure and
   * the ref: `latest` is written in a passive effect and effects run
   * child-first, so a consumer effect in the commit that turns `readOnly` on
   * runs BEFORE the ref learns of it, while the ref is what a stale handler
   * reads afterwards.
   */
  const locked = React.useCallback(
    () => disabled || readOnly || isFilterLocked(latest.current),
    [disabled, readOnly],
  );

  // Reports whether the write LANDED: `onBeforeQueryChange` is discoverable
  // only here, and a vetoed remove that still announced a count would lie.
  const emit = React.useCallback(
    (
      next: FilterQuery<V>,
      reason: FilterChangeDetails<V, O>["reason"],
      rule: FilterRule<V> | null,
    ): boolean => {
      // The backstop, redundant with each mutator's own early return, and
      // FIRST, so the consumer hook cannot approve what the lock refused.
      if (locked()) return false;
      const field = rule ? (getFilterField(latest.current.index, rule.path) ?? null) : null;
      const details: FilterChangeDetails<V, O> = { reason, rule, field };
      // Strictly `false`, so a handler that forgets to return is not a veto.
      if (latest.current.onBeforeQueryChange?.(next, details) === false) {
        return false;
      }
      latest.current.setQuery(next, details);
      return true;
    },
    [locked],
  );

  /**
   * Drops the roving tab stop when the node holding it no longer exists: a cell
   * claims it when the store names it, and the "row one takes it" fallback
   * fires only when the store is EMPTY, so a deleted id left twenty cells at
   * `tabindex="-1"` with focus on the BODY. Keyed on the committed `query`, so
   * a consumer's Reset or saved-view load is repaired too: add a condition,
   * press Reset, and every chip stayed untabbable.
   */
  React.useEffect(() => {
    const { id } = focusStore.getSnapshot();
    if (!id || findFilterNode(query, id)) return;
    focusStore.set({ id: null, segment: null, autoOpen: false });
  }, [query, focusStore]);

  const addRule = React.useCallback(
    (rule: FilterRule<V>) => {
      if (locked()) return;
      const next = insertFilterNode(latest.current.queryRef.current, rule);
      if (!emit(next, "add", rule)) return;
      setAnnouncement(latest.current.labels.countAnnouncement(countFilterRules(next)));
    },
    [emit, locked, setAnnouncement],
  );

  const updateRule = React.useCallback(
    (id: string, updates: Partial<Omit<FilterRule<V>, "id" | "type">>) => {
      if (locked()) return;
      const current = latest.current.queryRef.current;
      const next = updateFilterRule(current, id, updates);
      if (next === current) return;
      emit(next, "update", findFilterRule(next, id));
    },
    [emit, locked],
  );

  const removeNode = React.useCallback(
    (id: string) => {
      if (locked()) return;
      const current = latest.current.queryRef.current;
      const removed = findFilterRule(current, id);
      const next = removeFilterNode(current, id);
      if (next === current) return;
      if (!emit(next, "remove", removed)) return;
      setAnnouncement(latest.current.labels.countAnnouncement(countFilterRules(next)));
    },
    [emit, locked, setAnnouncement],
  );

  const duplicateNode = React.useCallback(
    (id: string) => {
      if (locked()) return;
      const current = latest.current.queryRef.current;
      const next = duplicateFilterNode(current, id, latest.current.nextId);
      if (next === current) return;
      if (!emit(next, "duplicate", findFilterRule(current, id))) return;
      setAnnouncement(latest.current.labels.countAnnouncement(countFilterRules(next)));
    },
    [emit, locked, setAnnouncement],
  );

  const negateRule = React.useCallback(
    (id: string) => {
      if (locked()) return;
      const current = latest.current.queryRef.current;
      const rule = findFilterRule(current, id);
      if (!rule) return;
      const field = getFilterField(latest.current.index, rule.path);
      if (!field) return;
      const operators = latest.current.resolveOperators(field);
      const flipped = negateFilterOperator(
        getFilterOperator(operators, rule.operator),
        operators,
        rule.negated,
      );
      const next = updateFilterRule(current, id, {
        operator: flipped.operator ?? rule.operator,
        negated: flipped.negated || undefined,
      });
      emit(next, "negate", findFilterRule(next, id));
    },
    [emit, locked],
  );

  const clearQueryAction = React.useCallback(() => {
    if (locked()) return;
    const current = latest.current.queryRef.current;
    const next = clearFilterQuery(current);
    if (next === current) return;
    if (!emit(next, "clear", null)) return;
    setAnnouncement(latest.current.labels.countAnnouncement(0));
  }, [emit, locked, setAnnouncement]);

  // The live region, opened to the chrome inside the bar. The setter itself is
  // not published: it is a channel anything could write anything to.
  const announce = React.useCallback(
    (message: string) => {
      if (!message) return;
      setAnnouncement(message);
    },
    [setAnnouncement],
  );

  // A draft is a MUTATION in progress, so it locks with the rest, except
  // `close`: a panel open when the bar turned read only must still dismiss.
  const dispatchDraft = React.useCallback(
    (action: FilterDraftAction<V>) => {
      if (action.type !== "close" && locked()) return;
      dispatchDraftRaw(action);
    },
    [locked],
  );

  const openCreate = React.useCallback(() => {
    if (locked()) return;
    dispatchDraftRaw({ type: "openCreate" });
  }, [locked]);

  const closeDraft = React.useCallback(() => dispatchDraftRaw({ type: "close" }), []);

  const getQuery = React.useCallback(() => latest.current.queryRef.current, []);

  /* ------------------------- draft -> query commit ------------------------ */

  // The draft becomes a rule exactly once, when the reducer says it is ready.
  // Here rather than in each click handler, which is what lets the "arity none
  // skips the value step" branch live in the pure reducer.
  React.useEffect(() => {
    if (draft?.status !== "ready") return;
    if (!isFilterDraftCommittable(draft)) return;

    if (draft.ruleId) {
      updateRule(draft.ruleId, {
        path: draft.path,
        operator: draft.operator ?? "",
        value: draft.value,
      });
    } else if (!locked()) {
      // Asked here too: this branch burns an id and points the focus store at
      // it, and a store naming a chip that never existed eats the tab stop.
      const id = nextId();
      addRule(
        createFilterRule<V>({
          id,
          path: draft.path,
          // Empty on purpose: the chip renders "Select condition" and opens.
          operator: "",
          value: undefined,
        }),
      );
      focusStore.set({ id, segment: "operator", autoOpen: true });
    }
    dispatchDraftRaw({ type: "close" });
  }, [draft, addRule, updateRule, nextId, focusStore, locked]);

  /* ---------------------------- dev diagnostics --------------------------- */

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const issues = findFilterSchemaIssues(fields, (field) =>
      resolveFilterOperators(field, operatorCatalog),
    );
    if (issues.duplicatePaths.length) {
      warnFilterOnce(
        `dup:${issues.duplicatePaths.join(",")}`,
        `duplicate sibling field ids are ignored after the first: ${issues.duplicatePaths.join(", ")}`,
      );
    }
    if (issues.emptyIds.length) {
      warnFilterOnce("empty-id", "every field needs a non-empty id");
    }
    if (issues.unknownDefaultOperators.length) {
      warnFilterOnce(
        `op:${issues.unknownDefaultOperators.join(",")}`,
        `defaultOperator names an operator the field does not offer: ${issues.unknownDefaultOperators.join(", ")}`,
      );
    }
  }, [fields, operatorCatalog]);

  /* ------------------------------- contexts ------------------------------- */

  const actions = React.useMemo<FilterActionsContextValue<V, O>>(
    () => ({
      index,
      labels,
      operatorCatalog,
      editors,
      size,
      disabled,
      readOnly,
      menuClassName,
      fieldPickerClassName,
      pathCollapse,
      maxPathSegments,
      resolveOperators,
      // The same lookup the chrome uses, so a headless consumer can ask it too.
      resolveEditor: (field, operator) =>
        resolveFilterEditor(field, operator, editors) as FilterEditor<V, O> | undefined,
      resolution: resolutionStore,
      addRule,
      updateRule,
      removeNode,
      duplicateNode,
      negateRule,
      clearQuery: clearQueryAction,
      openCreate,
      closeDraft,
      dispatchDraft,
      announce,
      getQuery,
      nextId,
    }),
    // Every input is memoized and every action `[]`-stable, so this
    // republishes on a real schema or config change, never on a keystroke.
    [
      index,
      labels,
      operatorCatalog,
      editors,
      size,
      disabled,
      readOnly,
      menuClassName,
      fieldPickerClassName,
      pathCollapse,
      maxPathSegments,
      resolveOperators,
      resolutionStore,
      addRule,
      updateRule,
      removeNode,
      duplicateNode,
      negateRule,
      clearQueryAction,
      openCreate,
      closeDraft,
      dispatchDraft,
      announce,
      getQuery,
      nextId,
    ],
  );

  const state = React.useMemo(
    () => ({
      query,
      draft,
      ruleCount,
      announcement,
      announcementSeq: announced.seq,
    }),
    [query, draft, ruleCount, announcement, announced.seq],
  );

  const renderContext = React.useMemo(
    () => ({ renderValue, renderChip }),
    [renderValue, renderChip],
  );

  return (
    <FilterActionsContext.Provider value={actions as unknown as FilterActionsContextValue}>
      <FilterStateContext.Provider value={state as never}>
        <FilterRenderContext.Provider value={renderContext as never}>
          <FilterFocusContext.Provider value={focusStore}>
            {children ?? (
              <FiltersRow trigger={trigger} showClear={showClear} className={className} />
            )}
          </FilterFocusContext.Provider>
        </FilterRenderContext.Provider>
      </FilterStateContext.Provider>
    </FilterActionsContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Row                                     */
/* -------------------------------------------------------------------------- */

export interface FiltersRowProps {
  trigger?: React.ReactNode;
  showClear?: boolean;
  className?: string;
}

/**
 * The chip row: a toolbar with a roving tabindex, where the predecessor made
 * every segment of every chip its own tab stop. There is NO combinator here,
 * because a chip row can draw a word between two pills but not a parenthesis.
 */
export function FiltersRow({ trigger, showClear, className }: Readonly<FiltersRowProps>) {
  const actions = useFilterActions();
  const sizes = filterControlSizes(actions);
  const { query, ruleCount, announcement, announcementSeq } = useFilterState();
  const focusStore = useFilterFocusStore();
  const rootRef = React.useRef<HTMLDivElement>(null);
  // The keys consult this even though the actions already refuse: an ungated
  // Enter would ARM `autoOpen` for a popover that then refuses to open. Gated
  // per branch, never at the top of `onKeyDown`: the arrows, Home and End are
  // how a read-only bar is read.
  const locked = isFilterLocked(actions);

  // Flattened, not `query.rules.filter(isFilterRule)`: a query built in the
  // another query source would otherwise hide nested persisted conditions.
  const rules = React.useMemo(() => flattenFilterRules(query), [query]);

  const chips = () =>
    Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-slot="filter-chip"]') ?? []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-slot="filter-chip"]');
    if (!target) return;
    // A key pressed inside an open popover belongs to that popover.
    if (event.target !== target) return;

    const all = chips();
    const current = all.indexOf(target);
    if (current === -1) return;

    const rtl = getComputedStyle(target).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";

    const focusAt = (index: number) => {
      const next = all[Math.max(0, Math.min(index, all.length - 1))];
      if (!next) return;
      event.preventDefault();
      next.focus();
    };

    const ruleId = target.dataset.ruleId;
    if (!ruleId) return;

    if (event.key === forward) return focusAt(current + 1);
    if (event.key === backward) return focusAt(current - 1);
    if (event.key === "Home") return focusAt(0);
    if (event.key === "End") return focusAt(all.length - 1);

    if (event.key === "Backspace" || event.key === "Delete") {
      if (locked) return;
      event.preventDefault();
      actions.removeNode(ruleId);
      // The neighbour taking this chip's place, so a run of deletes keeps focus.
      requestAnimationFrame(() => {
        const remaining = chips();
        remaining[Math.min(current, remaining.length - 1)]?.focus();
      });
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      if (locked) return;
      event.preventDefault();
      // Enter RESUMES the chip: the attribute segment is display only, so the
      // target is whichever step the flow has not reached, never nothing.
      const rule = findFilterRule(actions.getQuery(), ruleId);
      if (!rule) return;
      const field = getFilterField(actions.index, rule.path);
      // No popover to open, so autoOpen would sit armed until another chip
      // spent it. The chip stays reachable and Delete still removes it.
      if (!field) return;
      const operator = getFilterOperator(actions.resolveOperators(field), rule.operator);
      const segment = rule.operator && operatorTakesValue(operator) ? "value" : "operator";
      focusStore.set({ id: ruleId, segment, autoOpen: true });
    }
  };

  return (
    <div
      ref={rootRef}
      data-slot="filters"
      data-empty={rules.length === 0 || undefined}
      /* A presence hook, so a consumer can tint the whole read-only bar. */
      data-readonly={actions.readOnly || undefined}
      className={cn(
        /* `sizes.button` and not `actions.size`: the gap ladder and the control
           ladder must answer for the same rung, normalized in one place. */
        filtersBarVariants({ size: sizes.button }),
        /* An empty toolbar is still a flex child, so it took a gap with no
           width. The gap goes, not the toolbar, which owns the row's name. */
        rules.length === 0 && "gap-0",
        className,
      )}
    >
      <div
        role="toolbar"
        aria-label={actions.labels.filtersLabel}
        aria-orientation="horizontal"
        /* `role=toolbar` disallows `aria-readonly`, and `aria-disabled` would
           deny arrowing; a description is legal here and spoken on entry. */
        {...(actions.readOnly ? { "aria-description": actions.labels.readOnly } : null)}
        className={cn(filtersBarVariants({ size: sizes.button }))}
        onKeyDown={onKeyDown}
      >
        {rules.map((rule, index) => (
          <FilterChip key={rule.id} rule={rule} index={index} />
        ))}
      </div>

      <FiltersBuilder trigger={trigger} />

      {showClear && ruleCount > 0 ? (
        // `ms-auto` and not `ml-auto`, so Clear stays on the trailing edge
        // under RTL, where the whole bar mirrors.
        <Button
          variant="outline"
          /* The same rung as the Add filter trigger beside it. */
          size={sizes.button}
          className="ms-auto"
          /* `disabled` for the hard flag, `aria-disabled` for the soft one, so
             a read-only Clear keeps its tab stop and can still be found. */
          disabled={actions.disabled}
          {...filterReadOnlyProps(actions)}
          onClick={() => actions.clearQuery()}
        >
          {actions.labels.clear}
        </Button>
      ) : null}

      {/* Keyed on the sequence, so the same sentence twice is two
          announcements (see `announced` for the measurement). A replaced live
          element stops being watched. */}
      <div aria-live="polite" role="status" className="sr-only">
        <span key={announcementSeq}>{announcement}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Exports                                  */
/* -------------------------------------------------------------------------- */

// The full pure READ surface, so one import reaches everything a predicate, a
// saved view or a backend query needs. It stops at the query TREE and compiles
// nothing: `flattenFilterConditions` is the hand-off a server compiles from.
// No SQL emitter, because a server has to re-validate anything a browser sends
// and should compile from the tree rather than parse a client's string. SQL is
// one target of that hand-off beside Prisma, Drizzle, a REST query string and
// Elasticsearch.
export {
  createFilterQuery,
  createFilterRule,
  countFilterRules,
  flattenFilterConditions,
  flattenFilterRules,
  isFilterQueryEmpty,
  isFilterRuleComplete,
} from "~/components/reui/filters/filters-query";

export {
  // The read-only contract: the gate, and the props a mutating control wears.
  filterReadOnlyProps,
  isFilterLocked,
  useFilterActions,
  useFilterState,
  useFilterFocus,
  // What a custom chip needs to rebuild the roving scheme `renderChip` drops.
  useFilterChipAutoOpen,
  useFilterChipFocused,
  useFilterFocusEmpty,
  useFilterFocusStore,
  useFilterRender,
  useFilterSegmentFocus,
} from "~/components/reui/filters/filters-context";

export {
  FilterChip,
  FilterOperatorPopover,
  FilterRuleMenuItems,
  FilterValuePopover,
  useFilterRuleDisplay,
} from "~/components/reui/filters/filters-chip";
export { FiltersBuilder, FilterFieldPicker } from "~/components/reui/filters/filters-builder";
export { DEFAULT_FILTER_LABELS } from "~/components/reui/filters/filters-i18n";
export {
  DEFAULT_FILTER_OPERATORS,
  DEFAULT_FILTER_OPERATOR_LABELS,
} from "~/components/reui/filters/filters-operators";
export {
  DEFAULT_FILTER_EDITORS,
  useFilterOptions,
  useFilterValueResolution,
} from "~/components/reui/filters/filters-editors";

export type * from "~/components/reui/filters/filters-types";
