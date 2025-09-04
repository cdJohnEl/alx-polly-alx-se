// Minimal React type stubs for linting in environments without @types/react.
declare module 'react' {
  export type ReactNode = any;
  export type ChangeEvent<T = any> = { target: T };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(ctx: any): T;
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useState<T>(initial: T): [T, (v: T | ((prev: T) => T)) => void];
  export function useMemo<T>(factory: () => T, deps: any[]): T;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}


