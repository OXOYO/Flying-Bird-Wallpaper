import crypto from 'node:crypto'

export const generateSalt = () => crypto.randomBytes(16).toString('hex')

export const hashPassword = (password, salt) => {
  const hash = crypto.createHmac('sha256', salt)
  hash.update(password)
  return hash.digest('hex')
}

export const verifyPassword = (inputPassword, storedHash, salt) => {
  const inputHash = hashPassword(inputPassword, salt)
  return inputHash === storedHash
}
