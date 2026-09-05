"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { addNote } from "@/server/contacts/actions"

export function AddNote({ contactId }: { contactId: string }) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!body.trim()) return
    setSaving(true)
    const result = await addNote({ contactId, body })
    setSaving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setBody("")
    toast.success("Note added")
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        placeholder="Add a note…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button size="sm" onClick={submit} disabled={saving || !body.trim()}>
        {saving ? "Saving…" : "Add note"}
      </Button>
    </div>
  )
}
