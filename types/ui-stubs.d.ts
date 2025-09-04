// Stubs for third-party UI libs to satisfy TS where types may be missing.
declare module 'lucide-react' {
  export const Copy: any;
  export const Share2: any;
  export const Twitter: any;
  export const Facebook: any;
  export const Mail: any;
}

declare module 'sonner' {
  export const toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}


