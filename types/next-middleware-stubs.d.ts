declare module 'next/server' {
  export type NextRequest = any;
  export class NextResponse {
    static next(init?: { request?: any }): NextResponse;
    static redirect(url: any): NextResponse;
    cookies: {
      set: (name: string, value: string, options?: any) => void;
    };
  }
}

declare module '@supabase/ssr' {
  export function createServerClient(url: string, key: string, opts?: any): any;
}


