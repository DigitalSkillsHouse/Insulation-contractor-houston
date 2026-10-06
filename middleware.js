// middleware.js
export function middleware(request) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/admin')) {
    return;
  }

  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;

  // Fail closed if admin credentials are not configured.
  if (!ADMIN_USER || !ADMIN_PASS) {
    return new Response('Admin authentication is not configured.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }

  const auth = request.headers.get('authorization');

  if (auth) {
    const [scheme, encoded] = auth.split(' ');

    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = atob(encoded);
        const separator = decoded.indexOf(':');

        if (separator !== -1) {
          const user = decoded.slice(0, separator);
          const pass = decoded.slice(separator + 1);

          if (user === ADMIN_USER && pass === ADMIN_PASS) {
            return;
          }
        }
      } catch {
        // Invalid Base64/auth header. Continue to 401 below.
      }
    }
  }

  return new Response('Unauthorized Access', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Admin Access"'
    }
  });
}

export const config = {
  matcher: ['/admin/:path*']
};
