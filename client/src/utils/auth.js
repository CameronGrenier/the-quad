export function generateJWT(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = { ...payload, iat: now, exp: now + (60 * 60 * 24) };
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(jwtPayload));
  // Placeholder signature (in production, sign with a secret)
  const signature = btoa("thequadsignature");
  return `${base64Header}.${base64Payload}.${signature}`;
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "the-quad-salt");
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password, hashedPassword) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hashedPassword;
}

export function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token format');
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000))
      throw new Error('Token has expired');
    return payload;
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
}