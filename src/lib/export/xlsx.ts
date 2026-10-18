/**
 * A real Excel file (.xlsx), written without a library.
 *
 * Why not just CSV: Excel reads "+919876543210" from a CSV as a number and
 * shows 9.19877E+11, and it guesses at dates. In an .xlsx every cell carries
 * its type, so phone numbers stay text, amounts are numbers you can sum, and
 * dates are dates you can sort and filter by.
 *
 * The format is a zip of a few XML files. This writes the smallest set Excel,
 * Google Sheets, Numbers and LibreOffice all accept: one sheet with a bold,
 * frozen header row and filters on every column. Text is written inline
 * (never as a formula), so a buyer's name can't run as one.
 *
 * Server-only: uses node:zlib.
 */

import { deflateRawSync } from "node:zlib"

export type XlsxColumnType = "text" | "integer" | "money" | "datetime" | "date"

export type XlsxColumn = {
  header: string
  /** Width in characters. */
  width?: number
  type?: XlsxColumnType
}

/**
 * Cell values by column type:
 *   text      string
 *   integer   number
 *   money     integer paise, shown as rupees
 *   datetime  ISO timestamp, shown as India time
 *   date      ISO timestamp, shown as the calendar date in India
 */
export type XlsxValue = string | number | null | undefined

// ------------------------------------------------------------------ cells

const XML_UNSAFE = /[^\x09\x0A\x0D\x20-퟿-�\u{10000}-\u{10FFFF}]/gu

function xml(text: string): string {
  return text
    .replace(XML_UNSAFE, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function columnName(index: number): string {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const MS_PER_DAY = 86_400_000
/** Excel's day number for 1 January 1970. */
const UNIX_EPOCH_SERIAL = 25_569

/** An instant as Excel's day number, read on an Indian wall clock. */
function istSerial(iso: string): number | null {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return null
  return (ms + IST_OFFSET_MS) / MS_PER_DAY + UNIX_EPOCH_SERIAL
}

// Indexes into cellXfs in styles.xml below.
const STYLE = { header: 1, money: 2, datetime: 3, date: 4 } as const

function cell(ref: string, value: XlsxValue, type: XlsxColumnType): string {
  if (value === null || value === undefined || value === "") return ""

  if (type === "integer" && typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  if (type === "money" && typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${STYLE.money}"><v>${value / 100}</v></c>`
  }
  if ((type === "datetime" || type === "date") && typeof value === "string") {
    const serial = istSerial(value)
    if (serial !== null) {
      // Whole days for a date; whole seconds for a time, so no float noise.
      const v = type === "date" ? Math.floor(serial) : Math.round(serial * 86_400) / 86_400
      return `<c r="${ref}" s="${type === "date" ? STYLE.date : STYLE.datetime}"><v>${v}</v></c>`
    }
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`
}

// ------------------------------------------------------------------- parts

function sheetXml(columns: XlsxColumn[], rows: XlsxValue[][]): string {
  const last = columnName(Math.max(columns.length - 1, 0))
  const lastRow = rows.length + 1

  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 16}" customWidth="1"/>`)
    .join("")

  const header = columns
    .map(
      (c, i) =>
        `<c r="${columnName(i)}1" t="inlineStr" s="${STYLE.header}"><is><t xml:space="preserve">${xml(c.header)}</t></is></c>`
    )
    .join("")

  const body = rows
    .map((row, r) => {
      const cells = columns.map((c, i) => cell(`${columnName(i)}${r + 2}`, row[i], c.type ?? "text")).join("")
      return `<row r="${r + 2}">${cells}</row>`
    })
    .join("")

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<dimension ref="A1:${last}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData><row r="1">${header}</row>${body}</sheetData>` +
    `<autoFilter ref="A1:${last}${lastRow}"/>` +
    `</worksheet>`
  )
}

function workbookXml(sheetName: string, filterRef: string): string {
  const quoted = `'${sheetName.replace(/'/g, "''")}'`
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${xml(quoted)}!${filterRef}</definedName></definedNames>` +
    `</workbook>`
  )
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="dd mmm yyyy hh:mm"/><numFmt numFmtId="165" formatCode="dd mmm yyyy"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E6B8"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="5">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`

const ROOT_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`

const WORKBOOK_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`

// --------------------------------------------------------------------- zip

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** A zip archive of deflated files. Timestamps are fixed; nothing reads them. */
function zip(files: { name: string; data: string }[]): Buffer {
  const DOS_TIME = 0
  const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1 January 1980
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8")
    const raw = Buffer.from(file.data, "utf8")
    const packed = deflateRawSync(raw)
    const crc = crc32(raw)

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4) // version needed
    header.writeUInt16LE(0x0800, 6) // names are UTF-8
    header.writeUInt16LE(8, 8) // deflate
    header.writeUInt16LE(DOS_TIME, 10)
    header.writeUInt16LE(DOS_DATE, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(packed.length, 18)
    header.writeUInt32LE(raw.length, 22)
    header.writeUInt16LE(name.length, 26)
    header.writeUInt16LE(0, 28)
    local.push(header, name, packed)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4) // version made by
    entry.writeUInt16LE(20, 6) // version needed
    entry.writeUInt16LE(0x0800, 8)
    entry.writeUInt16LE(8, 10)
    entry.writeUInt16LE(DOS_TIME, 12)
    entry.writeUInt16LE(DOS_DATE, 14)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(packed.length, 20)
    entry.writeUInt32LE(raw.length, 24)
    entry.writeUInt16LE(name.length, 28)
    entry.writeUInt16LE(0, 30) // extra
    entry.writeUInt16LE(0, 32) // comment
    entry.writeUInt16LE(0, 34) // disk
    entry.writeUInt16LE(0, 36) // internal attributes
    entry.writeUInt32LE(0, 38) // external attributes
    entry.writeUInt32LE(offset, 42)
    central.push(entry, name)

    offset += header.length + name.length + packed.length
  }

  const centralSize = central.reduce((sum, b) => sum + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...local, ...central, end])
}

// -------------------------------------------------------------------- api

/** Excel's rules: at most 31 characters, none of \ / ? * [ ] : */
function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Sheet1"
}

export function buildXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxValue[][]): Buffer {
  const name = safeSheetName(sheetName)
  const last = columnName(Math.max(columns.length - 1, 0))
  const filterRef = `$A$1:$${last}$${rows.length + 1}`

  return zip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES_XML },
    { name: "_rels/.rels", data: ROOT_RELS_XML },
    { name: "xl/workbook.xml", data: workbookXml(name, filterRef) },
    { name: "xl/_rels/workbook.xml.rels", data: WORKBOOK_RELS_XML },
    { name: "xl/styles.xml", data: STYLES_XML },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(columns, rows) },
  ])
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
