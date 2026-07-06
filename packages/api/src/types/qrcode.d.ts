declare module 'qrcode' {
  interface QRCodeToBufferOptions {
    type?: 'image/png' | 'image/webp';
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  interface QRCodeToStringOptions {
    type?: 'svg';
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toBuffer(
    text: string,
    options?: QRCodeToBufferOptions
  ): Promise<Buffer>;

  export function toString(
    text: string,
    options?: QRCodeToStringOptions
  ): Promise<string>;
}
