import { jsPDF } from 'jspdf'
import type { Participant } from '../types'

const BADGE_PAGE_FORMAT: [number, number] = [105, 148]
const PAGE_WIDTH = 105
const PAGE_HEIGHT = 148
const CARD_X = 5
const CARD_Y = 5
const CARD_WIDTH = 95
const CARD_HEIGHT = 138
const LOGO_ASPECT_RATIO = 1369 / 1031
const assetCache = new Map<string, Promise<string>>()

const COLORS = {
  page: [243, 246, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  navy: [15, 23, 42] as [number, number, number],
  navySoft: [71, 85, 105] as [number, number, number],
  gold: [255, 194, 34] as [number, number, number],
  goldSoft: [255, 246, 221] as [number, number, number],
  ink: [7, 13, 13] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  panel: [248, 250, 252] as [number, number, number],
} as const

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Impossible de convertir la ressource en data URL.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Lecture de fichier impossible.'))
    reader.readAsDataURL(blob)
  })

const loadAssetAsDataUrl = (path: string) => {
  const cachedAsset = assetCache.get(path)

  if (cachedAsset) {
    return cachedAsset
  }

  const nextAsset = fetch(path)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Impossible de charger la ressource ${path}.`)
      }

      return response.blob()
    })
    .then(blobToDataUrl)

  assetCache.set(path, nextAsset)
  return nextAsset
}

const sanitizeFileSegment = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'participant'

const buildBadgeFileName = (participant: Participant) =>
  `badge-3d-impact-${sanitizeFileSegment(participant.firstName)}-${sanitizeFileSegment(participant.lastName)}-${participant.id.toLowerCase()}.pdf`

const toDisplayCase = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])([\p{L}])/gu, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase()}`,
    )

const getImageFormat = (dataUrl: string) =>
  dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'

const setFill = (doc: jsPDF, color: readonly [number, number, number]) => {
  doc.setFillColor(...color)
}

const setStroke = (doc: jsPDF, color: readonly [number, number, number], width = 0.3) => {
  doc.setDrawColor(...color)
  doc.setLineWidth(width)
}

const setText = (
  doc: jsPDF,
  color: readonly [number, number, number],
  size: number,
  weight: 'normal' | 'bold' = 'normal',
) => {
  doc.setTextColor(...color)
  doc.setFont('helvetica', weight)
  doc.setFontSize(size)
}

const roundedPanel = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: readonly [number, number, number],
  stroke: readonly [number, number, number] = COLORS.line,
  radius = 4,
) => {
  setFill(doc, fill)
  setStroke(doc, stroke)
  doc.roundedRect(x, y, width, height, radius, radius, 'FD')
}

const centered = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: readonly [number, number, number],
  weight: 'normal' | 'bold' = 'normal',
) => {
  setText(doc, color, size, weight)
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y, { align: 'center' })
  return lines.length
}

export const createBadgePdfAttachment = async (
  participant: Participant,
  qrCodeDataUrl: string,
  logoPath: string,
) => {
  const logoDataUrl = await loadAssetAsDataUrl(logoPath)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: BADGE_PAGE_FORMAT,
    compress: true,
  })

  setFill(doc, COLORS.page)
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 'F')
  roundedPanel(doc, CARD_X, CARD_Y, CARD_WIDTH, CARD_HEIGHT, COLORS.white, COLORS.line, 7)

  const fullName = [participant.firstName, participant.lastName]
    .map(toDisplayCase)
    .filter(Boolean)
    .join(' ')
  const typeLabel = participant.type === 'internal' ? 'INTERNAL' : 'EXTERNAL'
  const typeWidth = participant.type === 'internal' ? 24 : 26
  const infoPanelY = 61.5
  const infoPanelHeight = 20.5
  const qrPanelY = 86.8
  const qrPanelHeight = 46
  const qrFrameSize = 33
  const qrFrameX = PAGE_WIDTH / 2 - qrFrameSize / 2
  const qrFrameY = 94.5
  const qrImageSize = 28
  const qrImageX = PAGE_WIDTH / 2 - qrImageSize / 2
  const qrImageY = qrFrameY + (qrFrameSize - qrImageSize) / 2

  setFill(doc, COLORS.navy)
  doc.roundedRect(CARD_X, CARD_Y, CARD_WIDTH, 17.8, 7, 7, 'F')
  doc.rect(CARD_X, CARD_Y + 8, CARD_WIDTH, 9.8, 'F')
  setFill(doc, COLORS.gold)
  doc.rect(CARD_X, CARD_Y + 17.8, CARD_WIDTH, 1.6, 'F')

  setText(doc, COLORS.white, 7.1, 'bold')
  doc.text('3D IMPACT 2026', 10.5, 12.3)
  setText(doc, [203, 213, 225], 5.3, 'normal')
  doc.text('OFFICIAL EVENT CREDENTIAL', 10.5, 16.4)

  const logoWidth = 23
  const logoHeight = logoWidth / LOGO_ASPECT_RATIO
  const logoX = (PAGE_WIDTH - logoWidth) / 2
  doc.addImage(logoDataUrl, getImageFormat(logoDataUrl), logoX, 24.8, logoWidth, logoHeight)

  setText(doc, COLORS.navySoft, 5, 'bold')
  doc.text('EVENT ACCESS PASS', PAGE_WIDTH / 2, 45.5, { align: 'center' })
  setFill(doc, COLORS.gold)
  doc.roundedRect(PAGE_WIDTH / 2 - 6.5, 47.6, 13, 0.8, 0.4, 0.4, 'F')

  roundedPanel(
    doc,
    PAGE_WIDTH / 2 - typeWidth / 2,
    49.6,
    typeWidth,
    6.1,
    COLORS.goldSoft,
    COLORS.gold,
    3,
  )
  setText(doc, COLORS.ink, 6.4, 'bold')
  doc.text(typeLabel, PAGE_WIDTH / 2, 53.85, { align: 'center' })

  roundedPanel(doc, 12, infoPanelY, 81, infoPanelHeight, COLORS.panel, COLORS.line, 5)

  setText(doc, COLORS.navySoft, 5.1, 'bold')
  doc.text('PARTICIPANT', PAGE_WIDTH / 2, 68, { align: 'center' })

  const nameFontSize = fullName.length > 24 ? 12.2 : 14
  centered(
    doc,
    fullName,
    PAGE_WIDTH / 2,
    75.6,
    66,
    nameFontSize,
    COLORS.ink,
    'bold',
  )

  roundedPanel(doc, 12, qrPanelY, 81, qrPanelHeight, COLORS.navy, COLORS.navy, 6)
  setText(doc, COLORS.gold, 5.8, 'bold')
  doc.text('SCAN FOR ENTRY', PAGE_WIDTH / 2, 91.2, { align: 'center' })

  roundedPanel(doc, qrFrameX, qrFrameY, qrFrameSize, qrFrameSize, COLORS.white, COLORS.white, 4)
  doc.addImage(qrCodeDataUrl, 'PNG', qrImageX, qrImageY, qrImageSize, qrImageSize)

  roundedPanel(doc, 26, 136.1, 53, 6.1, COLORS.gold, COLORS.gold, 3)
  setText(doc, COLORS.ink, 7.2, 'bold')
  doc.text(participant.id, PAGE_WIDTH / 2, 140.1, { align: 'center' })

  return {
    fileName: buildBadgeFileName(participant),
    blob: doc.output('blob'),
  }
}
