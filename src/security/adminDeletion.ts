const ADMIN_DELETE_PASSWORD_HASH =
  import.meta.env.VITE_LOCAL_ADMIN_DELETE_PASSWORD_HASH?.trim() ||
  'a6dea4e4fbac230762a39d5fafa56f2f9f01942bce6f7f950f37c0afac40f7e2'

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
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(password.trim()))
  return timingSafeEqual(toHex(digest), ADMIN_DELETE_PASSWORD_HASH)
}
