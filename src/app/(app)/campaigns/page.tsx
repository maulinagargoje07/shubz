import { Megaphone } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Campaigns" }

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader title="Campaigns" description="WhatsApp broadcasts to a saved audience." />
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Megaphone className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">Coming soon</p>
            <p className="max-w-md text-sm text-muted-foreground">
              The database tables for campaigns, recipients and messages already exist, so
              connecting WhatsApp will not need a migration. The sending logic is not built
              yet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
