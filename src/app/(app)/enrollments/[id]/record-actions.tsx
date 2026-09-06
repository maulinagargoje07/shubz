"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatINR } from "@/lib/money"
import { deleteEnrollment } from "@/server/enrollments/actions"
import { voidPayment } from "@/server/payments/actions"

/**
 * Deleting a record.
 *
 * This soft-deletes: the row and its payments stay on file, and the receipt
 * numbers already issued remain accounted for. That is deliberate — a fee
 * book you can silently erase rows from is not a fee book.
 */
export function DeleteRecordButton({
  enrollmentId,
  studentName,
  variant = "outline",
  size = "default",
  showLabel = true,
  className,
}: {
  enrollmentId?: string
  studentName: string
  variant?: "outline" | "ghost" | "destructive"
  size?: "default" | "sm" | "icon"
  showLabel?: boolean
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onDelete() {
    const targetId =
      enrollmentId ??
      (typeof window !== "undefined" ? window.location.pathname.split("/")[2] : undefined)

    if (!targetId) {
      toast.error("Could not find record ID")
      return
    }

    setBusy(true)
    const result = await deleteEnrollment(targetId)
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setOpen(false)
    toast.success("Enrollment record deleted")
    router.push("/enrollments")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={variant}
            size={size}
            className={className ?? (variant === "outline" ? "text-overdue hover:bg-overdue/10 border-destructive/30" : "text-muted-foreground hover:text-overdue hover:bg-overdue/10")}
            title="Delete record"
            aria-label={`Delete record for ${studentName}`}
          >
            <Trash2 className="size-4 shrink-0" />
            {showLabel ? <span>Delete</span> : null}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete this enrollment record?</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1 text-sm text-muted-foreground">
          <p>
            Are you sure you want to delete the enrollment for{" "}
            <strong className="text-foreground font-semibold">{studentName}</strong>?
          </p>
          <p className="text-xs bg-muted/60 rounded-lg p-2.5 border border-border/70">
            This student record will be removed from active lists and fee schedules. Payments already recorded will remain in the accounting ledger.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
          <Button
            variant="destructive"
            disabled={busy}
            onClick={onDelete}
            className="w-full sm:w-auto"
          >
            {busy ? "Deleting…" : "Yes, delete record"}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Voiding a payment.
 *
 * The ledger is append-only, so this marks the payment void and re-derives the
 * balance rather than deleting the row. A reason is required: six months later
 * "why is there a void here" needs an answer.
 */
export function VoidPaymentButton({
  paymentId,
  amountPaise,
  receiptNo,
}: {
  paymentId: string
  amountPaise: number
  receiptNo: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function onVoid() {
    setBusy(true)
    const result = await voidPayment({ id: paymentId, reason })
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setOpen(false)
    setReason("")
    toast.success("Payment voided")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Void payment ${receiptNo}`}
            className="text-muted-foreground hover:text-overdue"
          >
            <Undo2 className="size-4" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void {receiptNo}?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {formatINR(amountPaise)} will stop counting toward this record, and the
          outstanding balance goes back up. The payment stays on file marked void,
          and its receipt shows as no longer valid.
        </p>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Entered twice by mistake"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant="destructive" disabled={reason.trim().length < 3 || busy} onClick={onVoid}>
            {busy ? "Voiding…" : "Void payment"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Row actions for the main Enrollments data grid and cards.
 * Provides quick access to View details, Edit record, and Delete record.
 */
export function EnrollmentRowActions({
  enrollmentId,
  studentName,
}: {
  enrollmentId: string
  studentName: string
}) {
  return (
    <div
      className="flex items-center justify-end gap-1.5"
      onClick={(e) => {
        // Prevent row navigation when clicking action buttons
        e.stopPropagation()
      }}
    >
      <Link
        href={`/enrollments/${enrollmentId}`}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
        title="View details"
        aria-label={`View record for ${studentName}`}
      >
        <Eye className="size-3.5" />
      </Link>
      <Link
        href={`/enrollments/${enrollmentId}/edit`}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-secondary/40 text-muted-foreground transition-all hover:border-primary/40 hover:bg-secondary hover:text-foreground active:scale-95"
        title="Edit record"
        aria-label={`Edit record for ${studentName}`}
      >
        <Pencil className="size-3.5" />
      </Link>
      <DeleteRecordButton
        enrollmentId={enrollmentId}
        studentName={studentName}
        variant="ghost"
        size="icon"
        showLabel={false}
        className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95"
      />
    </div>
  )
}
