const ADMIN_DELETE_PASSWORD_HASH =
  import.meta.env.VITE_LOCAL_ADMIN_DELETE_PASSWORD_HASH?.trim() ?? ''

const encoder = new TextEncoder()

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

export async function verifyAdminDeletionPassword(password: string) {
  if (!ADMIN_DELETE_PASSWORD_HASH) {
    return false
  }

  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(password.trim()))
  return timingSafeEqual(toHex(digest), ADMIN_DELETE_PASSWORD_HASH)
}
