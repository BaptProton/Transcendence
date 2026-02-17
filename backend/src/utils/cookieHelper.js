const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,           // flag secure, HTTPS only -> cookies pas lisibles par Javascript
  sameSite: 'lax',
  path: '/',
};

export function setAuthCookies(reply, accessToken, refreshToken) {
  reply.setCookie('access_token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 3600,
  });
  reply.setCookie('refresh_token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 604800,
  });
}

export function clearAuthCookies(reply) {
  reply.clearCookie('access_token', COOKIE_OPTIONS);
  reply.clearCookie('refresh_token', COOKIE_OPTIONS);
}
