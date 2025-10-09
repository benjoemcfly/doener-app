import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Alle /kitchen*-Routen schützen – außer /kitchen/login
  if (pathname.startsWith('/kitchen') && pathname !== '/kitchen/login') {
    const flag = req.cookies.get('kitchen')?.value;
    if (flag !== '1') {
      const url = req.nextUrl.clone();
      url.pathname = '/kitchen/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/kitchen/:path*'],
};
