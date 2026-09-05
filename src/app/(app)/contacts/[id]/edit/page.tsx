import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { getContact } from "@/server/contacts/queries"
import { ContactForm } from "../../contact-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit contact" }

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getContact(id)
  if (!contact) notFound()

  return (
    <div>
      <PageHeader title={`Edit ${contact.fullName}`} />
      <ContactForm contact={contact} />
    </div>
  )
}
