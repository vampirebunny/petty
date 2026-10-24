declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string;
}

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}

declare module 'node:crypto' {
  export function createHmac(
    algorithm: string,
    key: string,
  ): { update(value: string): { digest(encoding: string): string } };
  export function randomUUID(): string;
}

declare module 'node:child_process' {
  export function execSync(command: string, options: { encoding: 'utf8' }): string;
}

declare module 'node:http' {
  export type IncomingMessage = {
    statusCode?: number;
    headers: Record<string, string | string[] | undefined>;
    setEncoding(encoding: 'utf8'): void;
    on(event: 'data', listener: (chunk: string) => void): void;
    on(event: 'end', listener: () => void): void;
  };
  export type ClientRequest = {
    on(event: 'error', listener: (error: Error) => void): void;
    write(body: string): void;
    end(): void;
  };
  export function request(
    options: {
      hostname: string;
      port: string;
      path: string;
      method: string;
      headers: Record<string, string>;
    },
    listener: (response: IncomingMessage) => void,
  ): ClientRequest;
}
