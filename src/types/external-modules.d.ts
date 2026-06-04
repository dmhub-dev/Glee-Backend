declare module 'debug' {
  export interface DebugLogger {
    (...args: unknown[]): void;
    extend(namespace: string): DebugLogger;
  }

  function debug(namespace: string): DebugLogger;

  export default debug;
}
