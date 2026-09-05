"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Undo2 } from "lucide-react"
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
export function DeleteRecordButton({ studentName }: { studentName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  // The enrollment id is read from the URL so this stays a small client island.
  async function onDelete(id: string) {
    setBusy(true)
    const result = await deleteEnrollment(id)
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setOpen(false)
    toast.success("Record removed")
    router.push("/enrollments")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="text-overdue">
            <Trash2 className="size-4" />
            Delete
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this record?</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{studentName}</strong>&apos;s enrollment
          will be removed from lists and totals. Payments already recorded stay on
          file with their receipt numbers, so the books still reconcile.
        </p>

        <div className="space-y-2">
          <Label htmlFor="confirm">
            Type <span className="font-mono font-medium">delete</span> to confirm
          </Label>
          <Input
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            variant="destructive"
            disabled={confirm !== "delete" || busy}
            onClick={() => {
              const id = window.location.pathname.split("/")[2]
              if (id) onDelete(id)
            }}
          >
            {busy ? "Deleting…" : "Delete record"}
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
