import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return await bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(hash, plain) {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
