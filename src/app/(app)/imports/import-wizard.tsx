"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, FileUp, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { StatusPill } from "@/components/ui/status"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { guessColumnMap, IMPORTABLE_FIELDS, parseCsv, type ImportableField } from "@/lib/csv"
import { commitImport, previewImport } from "@/server/imports/actions"

type Step = "upload" | "map" | "preview" | "done"

type PreviewResult = {
  importId: string
  rowCount: number
  validCount: number
  dupCount: number
  invalidCount: number
  sample: {
    rowNumber: number
    status: "VALID" | "DUPLICATE" | "INVALID"
    errorMessage: string | null
    phoneE164: string | null
    fullName: string | null
  }[]
}

export function ImportWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("upload")
  const [filename, setFilename] = useState("")
  const [content, setContent] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [columnMap, setColumnMap] = useState<Partial<Record<ImportableField, string>>>({})
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const parsed = parseCsv(text)

    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error("That file has no readable rows.")
      return
    }

    setFilename(file.name)
    setContent(text)
    setHeaders(parsed.headers)
    setRowCount(parsed.rows.length)
    // Start from a best guess so the common case needs no mapping at all.
    setColumnMap(guessColumnMap(parsed.headers))
    setStep("map")
  }

  async function runPreview() {
    if (!columnMap.fullName || !columnMap.phone) {
      toast.error("Name and phone must both be mapped.")
      return
    }

    setBusy(true)
    const result = await previewImport({ filename, content, columnMap, source: "IMPORT" })
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setPreview(result.data as PreviewResult)
    setStep("preview")
  }

  async function commit() {
    if (!preview) return
    setBusy(true)
    const result = await commitImport({ importId: preview.importId })
    setBusy(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(`Imported ${result.data.created} contact${result.data.created === 1 ? "" : "s"}`)
    setStep("done")
    router.refresh()
  }

  function reset() {
    setStep("upload")
    setFilename("")
    setContent("")
    setHeaders([])
    setColumnMap({})
    setPreview(null)
  }

  if (step === "upload") {
    return (
      <div className="px-4 py-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileUp className="size-5" aria-hidden />
          </div>
          <div>
            <p className="font-medium">Choose a CSV file</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Phone numbers are normalised to +91 form and checked against existing
              contacts before anything is written.
            </p>
          </div>
          <input
            id="csv"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={onFile}
          />
          <Button render={<label htmlFor="csv" />}>
            <Upload className="size-4" />
            Select file
          </Button>
        </div>
      </div>
    )
  }

  if (step === "map") {
    return (
      <div className="max-w-2xl space-y-6 px-4 py-4 sm:px-6">
        <Alert>
          <AlertDescription>
            <strong>{filename}</strong> · {rowCount} row{rowCount === 1 ? "" : "s"}. Check the
            column mapping below.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          {IMPORTABLE_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-2 items-center gap-4">
              <Label htmlFor={field.key}>
                {field.label}
                {field.required ? <span className="text-destructive"> *</span> : null}
              </Label>
              <Select
                value={columnMap[field.key] ?? "__skip"}
                onValueChange={(v) =>
                  setColumnMap((m) => ({
                    ...m,
                    [field.key]: !v || v === "__skip" ? undefined : v,
                  }))
                }
              >
                <SelectTrigger id={field.key}>
                  <SelectValue placeholder="Not mapped" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__skip">Skip this field</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button onClick={runPreview} disabled={busy}>
            {busy ? "Checking…" : "Validate"}
          </Button>
          <Button variant="outline" onClick={reset}>
            Start over
          </Button>
        </div>
      </div>
    )
  }

  if (step === "preview" && preview) {
    return (
      <div className="space-y-6 px-4 py-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Count
            label="Valid"
            value={preview.validCount}
            tone="good"
            hint="Will be created"
          />
          <Count
            label="Duplicate"
            value={preview.dupCount}
            hint="Already on file or repeated"
          />
          <Count
            label="Invalid"
            value={preview.invalidCount}
            tone={preview.invalidCount > 0 ? "bad" : undefined}
            hint="Missing or unreadable data"
          />
        </div>

        <p className="text-sm text-muted-foreground">
          {preview.rowCount} row{preview.rowCount === 1 ? "" : "s"} read from{" "}
          <strong>{filename}</strong>. Nothing has been written yet.
        </p>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide">Row</th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide">Name</th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide">Phone</th>
                <th className="px-4 py-2 text-xs font-medium uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.sample.map((row) => (
                <tr key={row.rowNumber}>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {row.rowNumber}
                  </td>
                  <td className="px-4 py-2">{row.fullName ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums">{row.phoneE164 ?? "—"}</td>
                  <td className="px-4 py-2">
                    <StatusPill
                      tone={
                        row.status === "VALID"
                          ? "paid"
                          : row.status === "INVALID"
                            ? "overdue"
                            : "pending"
                      }
                    >
                      {row.status === "VALID"
                        ? "Valid"
                        : row.status === "DUPLICATE"
                          ? "Duplicate"
                          : "Invalid"}
                    </StatusPill>
                    {row.errorMessage ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {row.errorMessage}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.rowCount > preview.sample.length ? (
            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
              Showing the first {preview.sample.length} rows.
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Button onClick={commit} disabled={busy || preview.validCount === 0}>
            {busy
              ? "Importing…"
              : `Import ${preview.validCount} contact${preview.validCount === 1 ? "" : "s"}`}
          </Button>
          <Button variant="outline" onClick={reset}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
        <div className="rounded-xl border bg-card p-6">
          <CheckCircle2 className="size-8 text-paid" aria-hidden />
          <p className="font-medium">Import complete</p>
          <div className="flex gap-2">
            <Button onClick={reset}>Import another file</Button>
            <Button variant="outline" onClick={() => router.push("/contacts")}>
              View contacts
            </Button>
          </div>
        </div>
    </div>
  )
}

function Count({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone?: "good" | "bad"
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {tone === "good" ? (
          <CheckCircle2 className="size-4 text-paid" aria-hidden />
        ) : tone === "bad" ? (
          <XCircle className="size-4 text-overdue" aria-hidden />
        ) : null}
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
