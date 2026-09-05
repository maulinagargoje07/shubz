import { StatusPill, lifecycleTone } from "@/components/ui/status"
import type { Column } from "@/components/data-table/table"
import { formatDate } from "@/lib/fy"
import { formatE164 } from "@/lib/phone-format"
import { LIFECYCLE_LABELS, SOURCE_LABELS } from "@/lib/labels"
import type { ContactListRow } from "@/server/contacts/queries"

/**
 * Column definitions shared by the Contacts and Students lists.
 *
 * Priorities decide both which columns survive a narrow viewport and how the
 * mobile card is laid out: the name is the card title, phone and stage are its
 * metadata, and city/source/added drop away entirely rather than forcing a
 * sideways scroll.
 */
export const contactColumns: Column<ContactListRow>[] = [
  {
    id: "name",
    header: "Name",
    priority: "primary",
    cell: (row) => row.fullName,
  },
  {
    id: "phone",
    header: "Phone",
    priority: "primary",
    cell: (row) => (
      <span className="tabular-nums">{formatE164(row.phoneE164)}</span>
    ),
  },
  {
    id: "stage",
    header: "Stage",
    priority: "secondary",
    hideLabelOnCard: true,
    cell: (row) => (
      <StatusPill tone={lifecycleTone(row.lifecycleStage)}>
        {LIFECYCLE_LABELS[row.lifecycleStage]}
      </StatusPill>
    ),
  },
  {
    id: "email",
    header: "Email",
    priority: "tertiary",
    cell: (row) =>
      row.email ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "city",
    header: "City",
    priority: "tertiary",
    cell: (row) => row.city ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "source",
    header: "Source",
    priority: "tertiary",
    cell: (row) => (
      <span className="text-muted-foreground">{SOURCE_LABELS[row.source]}</span>
    ),
  },
  {
    id: "added",
    header: "Added",
    priority: "tertiary",
    align: "right",
    cell: (row) => (
      <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>
    ),
  },
]
