import type { CommitteeBadgeType } from '../types'

export const DEFAULT_COMMITTEE_BADGE_TYPE: CommitteeBadgeType = 'committee'

const ENSATPRESS_ALIASES = new Set([
  'ensatpress',
  'ensat-press',
  'press',
  'presse',
  'committee_press',
  'committee_presse',
  'comite_presse',
  'comite presse',
  'comitepress',
])

const COMMITTEE_BADGE_PROFILES = {
  committee: {
    label: 'Membre du comité',
    color: '#FFC222',
    textColor: '#0F172A',
    assignmentMessage:
      "Votre badge comité vous est attribué pour cette édition. Merci de le présenter à chaque contrôle d'accès.",
  },
  ensatpress: {
    label: 'ENSATPRESS',
    color: '#2563EB',
    textColor: '#FFFFFF',
    assignmentMessage:
      "Votre badge ENSATPRESS vous est attribué au titre du comité presse. Merci de le conserver visible pendant toute la durée de l'événement.",
  },
} as const

export const normalizeCommitteeBadgeType = (value: unknown): CommitteeBadgeType => {
  const normalizedValue = String(value ?? '')
    .trim()
    .toLowerCase()

  if (ENSATPRESS_ALIASES.has(normalizedValue)) {
    return 'ensatpress'
  }

  return DEFAULT_COMMITTEE_BADGE_TYPE
}

export const getCommitteeBadgeProfile = (badgeType: CommitteeBadgeType) =>
  COMMITTEE_BADGE_PROFILES[normalizeCommitteeBadgeType(badgeType)]
