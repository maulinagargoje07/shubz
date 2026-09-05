import { MessageSquareText } from "lucide-react"

import { EmptyState } from "@/components/ui/status"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Templates" }

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader title="Templates" description="Message templates registered with Meta." />
      <div className="px-4 py-4 sm:px-6">
        <EmptyState
          icon={<MessageSquareText className="size-5" />}
          title="Coming soon"
          description="The message_templates table is in place, including the variable map that points friendly field names at Meta's positional parameters."
        />
      </div>
    </div>
  )
}
