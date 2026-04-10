declare module "ali-oss" {
  export interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint?: string;
    secure?: boolean;
  }

  export interface OSSObjectMeta {
    name: string;
    url?: string;
    lastModified?: string;
    size?: number;
  }

  export interface OSSListResult {
    objects?: OSSObjectMeta[];
    isTruncated?: boolean;
    nextMarker?: string;
  }

  export default class OSS {
    constructor(options: OSSOptions);
    put(name: string, file: Buffer | string): Promise<unknown>;
    get(name: string): Promise<{ content: Buffer }>;
    list(query: {
      prefix?: string;
      marker?: string;
      "max-keys"?: number;
    }): Promise<OSSListResult>;
  }
}
