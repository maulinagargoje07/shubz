import { MessageSquareText } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Templates" }

export default function TemplatesPage() {
  return (
    <div>
      <PageHeader
        title="Templates"
        description="Message templates registered with Meta."
      />
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <MessageSquareText className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Coming soon</p>
            <p className="max-w-md text-sm text-muted-foreground">
              The message_templates table is in place, including the variable map that
              points friendly field names at Meta&apos;s positional parameters.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
