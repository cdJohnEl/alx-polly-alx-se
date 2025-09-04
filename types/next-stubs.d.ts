// Minimal module stubs to satisfy TypeScript in this environment.
// At runtime, Next.js will provide the actual implementations.

declare module 'next/cache' {
  export function revalidatePath(path: string): void;
}

declare module 'next/headers' {
  export function cookies(): Promise<{
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => Array<{ name: string; value: string }>;
  }> | {
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => Array<{ name: string; value: string }>;
  };
}


