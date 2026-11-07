// One JSON line per event (design D7). CloudWatch picks up stdout/stderr from Lambda.
// Never log request bodies or tool query text: they are public, untrusted input.

export type LogFields = Record<string, unknown>;
export type Logger = (level: 'info' | 'error', event: string, fields?: LogFields) => void;

export const log: Logger = (level, event, fields = {}) => {
  const line = JSON.stringify({ level, event, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
};
