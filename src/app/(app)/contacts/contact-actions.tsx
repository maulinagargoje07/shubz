"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { deleteContact } from "@/server/contacts/actions"

/**
 * Soft delete button for a contact.
 * Accessible from both the contact detail header and table row actions.
 */
export function DeleteContactButton({
  contactId,
  contactName,
  variant = "outline",
  size = "default",
  showLabel = true,
  className,
}: {
  contactId: string
  contactName: string
  variant?: "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "icon"
  showLabel?: boolean
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onDelete() {
    setBusy(true)
    const result = await deleteContact(contactId)
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setOpen(false)
    toast.success("Contact deleted")
    router.push("/contacts")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={
              className ??
              (variant === "outline"
                ? "text-overdue hover:bg-overdue/10 border-destructive/30"
                : "text-muted-foreground hover:text-overdue hover:bg-overdue/10")
            }
            title="Delete contact"
            aria-label={`Delete contact ${contactName}`}
          >
            <Trash2 className="size-4 shrink-0" />
            {showLabel ? <span>Delete</span> : null}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete this contact?</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 text-sm text-muted-foreground">
          <p>
            Are you sure you want to delete{" "}
            <strong className="text-foreground font-semibold">{contactName}</strong>?
          </p>
          <p className="text-xs bg-muted/60 rounded-lg p-2.5 border border-border/70">
            This contact will be removed from active lists and their phone number will be released. Existing enrollment and payment history will remain recorded.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
          <Button
            variant="destructive"
            disabled={busy}
            onClick={onDelete}
            className="w-full sm:w-auto"
          >
            {busy ? "Deleting…" : "Yes, delete contact"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Row actions for the Contacts and Students table grids.
 */
export function ContactRowActions({
  contactId,
  contactName,
}: {
  contactId: string
  contactName: string
}) {
  return (
    <div
      className="flex items-center justify-end gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Link
        href={`/contacts/${contactId}`}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
        title="View profile"
        aria-label={`View profile for ${contactName}`}
      >
        <Eye className="size-3.5" />
      </Link>
      <Link
        href={`/contacts/${contactId}/edit`}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
        title="Edit contact"
        aria-label={`Edit contact for ${contactName}`}
      >
        <Pencil className="size-3.5" />
      </Link>
      <Link
        href={`/enrollments/new`}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-primary active:scale-95"
        title="Enroll student"
        aria-label={`Enroll ${contactName}`}
      >
        <UserPlus className="size-3.5" />
      </Link>
      <DeleteContactButton
        contactId={contactId}
        contactName={contactName}
        variant="ghost"
        size="icon"
        showLabel={false}
        className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95"
      />
    </div>
  )
}
