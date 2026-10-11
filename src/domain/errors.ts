export type DockTabsErrorCode = 'BOOT_FAILED' | 'CHROME_FAILED' | 'DATA_INVALID' | 'IMPORT_INVALID' | 'URL_INVALID';

export class DockTabsError extends Error {
  public readonly code: DockTabsErrorCode;

  public constructor(code: DockTabsErrorCode, message: string) {
    super(message);
    this.name = 'DockTabsError';
    this.code = code;
  }
}
