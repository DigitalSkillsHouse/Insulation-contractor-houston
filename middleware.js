// middleware.js
export const config = {
  matcher: ['/admin', '/admin/:path*']
};

function nextResponse() {
  return new Response(null, {
    headers: {
      'x-middleware-next': '1'
    }
  });
}

export function middleware(request) {
  try {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/admin')) {
      return nextResponse();
    }

    const ADMIN_USER = process.env.ADMIN_USER;
    const ADMIN_PASS = process.env.ADMIN_PASS;

    // If admin credentials are not configured in Vercel, allow passage to admin login UI or return 503 notice
    if (!ADMIN_USER || !ADMIN_PASS) {
      console.warn('[middleware] ADMIN_USER or ADMIN_PASS missing in environment variables.');
      return new Response('Admin authentication is not configured in Vercel environment variables (ADMIN_USER and ADMIN_PASS required).', {
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
              return nextResponse();
            }
          }
        } catch {
          // Invalid Base64 / auth header. Continue to 401.
        }
      }
    }

    return new Response('Unauthorized Access', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin Access"'
      }
    });
  } catch (err) {
    console.error('[middleware] Error:', err);
    return nextResponse();
  }
}
