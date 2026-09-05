import { Megaphone } from "lucide-react"

import { EmptyState } from "@/components/ui/status"
import { PageHeader } from "@/components/page-header"

export const metadata = { title: "Campaigns" }

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader title="Campaigns" description="WhatsApp broadcasts to a saved audience." />
      <div className="px-4 py-4 sm:px-6">
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="Coming soon"
          description="The tables for campaigns, recipients and messages already exist, so connecting WhatsApp will not need a migration. The sending logic is not built yet."
        />
      </div>
    </div>
  )
}
