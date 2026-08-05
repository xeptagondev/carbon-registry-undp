import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FilterOption, FilterValue } from "./FilterBar";

const DEFAULT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;
// Distance from the bottom (px) that triggers the next page.
const SCROLL_THRESHOLD_PX = 24;
// Default options to load up front before relying on scroll. A page smaller
// than the popup's row capacity never overflows it, so no scrollbar (and no
// `onPopupScroll`) ever appears — each fresh load keeps fetching until it has
// this many (or the backend is exhausted). A no-op once page size >= this.
const DEFAULT_MIN_FILL = 10;

export interface FetchPageParams {
  search: string;
  page: number;
  size: number;
}

export interface UsePaginatedSelectOptionsParams {
  /** Fetches one page of options for a (possibly empty) search term. Page is
   * 1-based. Should return this page's options only — the hook accumulates
   * them across scrolls. */
  fetchPage: (params: FetchPageParams) => Promise<FilterOption[]>;
  /** The select's current value — its options are kept in `options` through
   * searches so selected labels never fall back to the raw id (sticky cache). */
  selectedValues: FilterValue[];
  pageSize?: number;
  /** Options loaded up front before relying on scroll; match to a custom
   * `listHeight`. Defaults to 10 (fits antd's 256px popup). */
  minFill?: number;
}

export interface PaginatedSelectOptions {
  options: FilterOption[];
  loading: boolean;
  /** Debounced; a new term resets to page 1. */
  onSearch: (text: string) => void;
  /** Near-bottom → fetch and append the next page. */
  onPopupScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  /** Fetch page 1 the first time the dropdown opens (lazy initial load). */
  onDropdownOpen: () => void;
}

const dedupeByValue = (options: FilterOption[]): FilterOption[] => {
  const seen = new Set<FilterValue>();
  const result: FilterOption[] = [];
  for (const option of options) {
    if (seen.has(option.value)) continue;
    seen.add(option.value);
    result.push(option);
  }
  return result;
};

/**
 * Drives an async, server-paginated, server-searched FilterBar select:
 * loads one page at a time, appends more on scroll, and re-queries the
 * backend (debounced) as the user types — instead of preloading the whole
 * list and filtering it client-side. Pair with a FilterBar select control
 * marked `serverSearch: true`, spreading this hook's returns onto it.
 */
export const usePaginatedSelectOptions = ({
  fetchPage,
  selectedValues,
  pageSize = DEFAULT_PAGE_SIZE,
  minFill = DEFAULT_MIN_FILL,
}: UsePaginatedSelectOptionsParams): PaginatedSelectOptions => {
  const [pageOptions, setPageOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Refs (not state) for paging bookkeeping the scroll/search callbacks must
  // read synchronously, without waiting for a re-render.
  const searchRef = useRef("");
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const initializedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedValuesRef = useRef<Set<FilterValue>>(new Set());
  // Every option ever loaded, so selected values keep their labels.
  const cacheRef = useRef<Map<FilterValue, FilterOption>>(new Map());
  // Bumps per search/reset; a fetch resolving with a stale token is dropped.
  const requestTokenRef = useRef(0);

  const loadPage = useCallback(
    async (startPage: number, append: boolean) => {
      const token = requestTokenRef.current;
      setLoading(true);
      loadingRef.current = true;
      try {
        let page = startPage;
        let appendPage = append;
        // Fetch pages until >= minFill distinct options (scrollable) or the
        // backend runs out; loops once when a single page already meets minFill.
        for (;;) {
          const search = searchRef.current;
          const isAppend = appendPage;
          const fetched = await fetchPage({ search, page, size: pageSize });
          if (token !== requestTokenRef.current) return; // superseded
          if (!isAppend) loadedValuesRef.current.clear();
          fetched.forEach((option) => {
            cacheRef.current.set(option.value, option);
            loadedValuesRef.current.add(option.value);
          });
          pageRef.current = page;
          hasMoreRef.current = fetched.length === pageSize;
          setPageOptions((prev) => (isAppend ? [...prev, ...fetched] : fetched));
          if (!hasMoreRef.current || loadedValuesRef.current.size >= minFill) break;
          page += 1;
          appendPage = true;
        }
      } catch (error) {
        if (token !== requestTokenRef.current) return;
        console.error("Error loading paginated select options", error);
        hasMoreRef.current = false;
      } finally {
        if (token === requestTokenRef.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [fetchPage, pageSize, minFill]
  );

  const resetAndLoad = useCallback(
    (search: string) => {
      requestTokenRef.current += 1;
      searchRef.current = search;
      pageRef.current = 0;
      hasMoreRef.current = true;
      loadedValuesRef.current.clear();
      loadPage(1, false);
    },
    [loadPage]
  );

  const onDropdownOpen = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    resetAndLoad("");
  }, [resetAndLoad]);

  const onSearch = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const next = text.trim();
        // antd fires onSearch("") when it clears the box after a pick/close;
        // skip the reload when the term is unchanged so a selection doesn't
        // refetch page 1 and drop the scrolled-in pages.
        if (initializedRef.current && next === searchRef.current) return;
        initializedRef.current = true;
        resetAndLoad(next);
      }, SEARCH_DEBOUNCE_MS);
    },
    [resetAndLoad]
  );

  const onPopupScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const nearBottom =
        target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_THRESHOLD_PX;
      if (nearBottom && hasMoreRef.current && !loadingRef.current) {
        loadPage(pageRef.current + 1, true);
      }
    },
    [loadPage]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Selected options (from cache) ahead of the current page, so their labels
  // survive searches that narrow them out of the results.
  const options = useMemo(() => {
    const selected = selectedValues
      .map((value) => cacheRef.current.get(value))
      .filter((option): option is FilterOption => option !== undefined);
    return dedupeByValue([...selected, ...pageOptions]);
  }, [selectedValues, pageOptions]);

  return { options, loading, onSearch, onPopupScroll, onDropdownOpen };
};
