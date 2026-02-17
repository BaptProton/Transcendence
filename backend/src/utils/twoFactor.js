import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateSecret(username, issuer = 'ft_transcendence') {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${username})`,
    issuer: issuer,
    length: 32,
  });

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
}

export async function generateQRCode(otpauthUrl) {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return qrCodeDataUrl;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

export function verifyToken(secret, token, window = 1) {
  if (!secret || !token) {
    return false;
  }

  const cleanToken = token.toString().replace(/\s/g, '');
  if (cleanToken.length !== 6 || !/^\d+$/.test(cleanToken)) {
    return false;
  }

  try {
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: cleanToken,
      window: window, // Tolérance de 30 secondes
    });

    return verified;
  } catch (error) {
    console.error('[ERROR] Error verifying TOTP token:', error);
    return false;
  }
}
