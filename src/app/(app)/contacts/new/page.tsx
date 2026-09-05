import { PageHeader } from "@/components/page-header"
import { ContactForm } from "../contact-form"

export const metadata = { title: "Add contact" }

export default function NewContactPage() {
  return (
    <div>
      <PageHeader title="Add contact" description="Phone numbers are stored in +91 form." />
      <ContactForm />
    </div>
  )
}
