/**
 * The muted second line under a list row's title.
 *
 * It exists because those sub-lines are assembled from parts that are often
 * absent — a batch that is not set, a seat that does not apply, a program kind
 * that would only repeat the name above it. Written inline, each combination
 * needed its own ternary for the separator, and an all-empty result still
 * rendered an empty paragraph that took up space in the row.
 *
 * Passing the parts in and letting this drop the empty ones keeps the
 * separators correct however many survive, and renders nothing at all when
 * none do.
 */
export function SubLabel({
  parts,
  className = "truncate text-xs text-muted-foreground",
}: {
  parts: (string | null | undefined | false)[]
  className?: string
}) {
  const kept = parts.filter((part): part is string => Boolean(part))
  if (kept.length === 0) return null
  return <p className={className}>{kept.join(" · ")}</p>
}
