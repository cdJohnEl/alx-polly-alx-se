// Minimal Node process env stub to satisfy TS without @types/node
declare var process: {
  env: Record<string, string | undefined>;
};


