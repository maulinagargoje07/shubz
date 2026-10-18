/**
 * Reading the Indicator pages' filters out of the URL.
 *
 * Shared by each list page and its Excel/CSV download, so a download always
 * holds exactly the rows on screen (every page of them). Anything that is not
 * a known value is treated as "no filter", never as an error — a stale
 * bookmark should show the whole list, not a broken page.
 */

import {
  ACCESS_FILTER_VALUES,
  INDICATOR_MODES,
  RECOVERED_FILTER_VALUES,
  STATUS_FILTER_VALUES,
  type AccessFilter,
  type IndicatorMode,
  type RecoveredFilter,
  type StatusFilter,
} from "@/lib/indicator"
import { enumParam, pageParam, textParam, type RawParam } from "@/lib/search-params"

export const PER_PAGE = 50

export type ParamReader = (key: string) => RawParam

/** For a page's `searchParams` object. */
export function fromRecord(record: Record<string, RawParam>): ParamReader {
  return (key) => record[key]
}

/** For a route handler's URL. */
export function fromUrl(url: URL): ParamReader {
  return (key) => url.searchParams.get(key) ?? undefined
}

/** A "yyyy-MM-dd" that is a real calendar date, or undefined. */
export function dateParam(value: RawParam): string | undefined {
  const text = textParam(value)
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : undefined
}

export function modeParam(get: ParamReader): IndicatorMode | undefined {
  return enumParam(get("mode"), INDICATOR_MODES)
}

export type SubscriberFilters = {
  mode?: IndicatorMode
  q?: string
  status?: StatusFilter
  access?: AccessFilter
  page: number
}

export function subscriberFilters(get: ParamReader): SubscriberFilters {
  return {
    mode: modeParam(get),
    q: textParam(get("q")),
    status: enumParam(get("status"), STATUS_FILTER_VALUES),
    access: enumParam(get("access"), ACCESS_FILTER_VALUES),
    page: pageParam(get("page")),
  }
}

export type PaymentFilters = {
  mode?: IndicatorMode
  q?: string
  from?: string
  to?: string
  page: number
}

export function paymentFilters(get: ParamReader): PaymentFilters {
  return {
    mode: modeParam(get),
    q: textParam(get("q")),
    from: dateParam(get("from")),
    to: dateParam(get("to")),
    page: pageParam(get("page")),
  }
}

export type FailedFilters = {
  mode?: IndicatorMode
  q?: string
  recovered?: RecoveredFilter
  page: number
}

export function failedFilters(get: ParamReader): FailedFilters {
  return {
    mode: modeParam(get),
    q: textParam(get("q")),
    recovered: enumParam(get("recovered"), RECOVERED_FILTER_VALUES),
    page: pageParam(get("page")),
  }
}

/**
 * The filters as URL params, for links that keep them: pagination, the
 * downloads, the mode switch. Page is left out on purpose — a download wants
 * every page, and switching mode starts again at the first.
 */
export function filterParams(
  filters: Record<string, string | number | undefined>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (key === "page" || value === undefined || value === "") continue
    out[key] = String(value)
  }
  return out
}

export function hrefWith(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
