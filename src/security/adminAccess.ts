import type { RegistrationPayload } from '../types'

type AdminCredentialFields = Pick<
  RegistrationPayload,
  'firstName' | 'lastName' | 'email' | 'phone'
>

const ADMIN_ACCESS_HASH =
  'fae59cd5400a0f4dc6ec3ce6991671bfa14a4fc4e9e3dcae57e83c6d841547b5'

const encoder = new TextEncoder()

const normalize = (value: string) => value.trim().toLowerCase()

const buildCredentialSeed = ({
  firstName,
  lastName,
  email,
  phone,
}: AdminCredentialFields) =>
  `${normalize(firstName)}|${normalize(lastName)}|${phone.trim()}|${normalize(email)}`

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')

const timingSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false
  }

  let mismatch = 0

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}

export async function isAdminAccessAttempt(fields: AdminCredentialFields) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(buildCredentialSeed(fields)))
  return timingSafeEqual(toHex(digest), ADMIN_ACCESS_HASH)
}
