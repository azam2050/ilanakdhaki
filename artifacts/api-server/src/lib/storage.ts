import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";

const endpoint = process.env.BUCKET_ENDPOINT;
const region = process.env.BUCKET_REGION ?? "auto";
const accessKeyId = process.env.BUCKET_ACCESS_KEY_ID;
const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY;
const bucketName = process.env.BUCKET_NAME;

let _client: S3Client | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(endpoint && accessKeyId && secretAccessKey && bucketName);
}

export function getBucketName(): string {
  if (!bucketName) throw new Error("BUCKET_NAME not set");
  return bucketName;
}

function client(): S3Client {
  if (!isStorageConfigured()) {
    throw new Error("Object storage not configured (BUCKET_* envs missing)");
  }
  if (!_client) {
    _client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
      forcePathStyle: true,
    });
  }
  return _client;
}

export async function uploadObject(opts: {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  contentLength?: number;
}): Promise<void> {
  const upload = new Upload({
    client: client(),
    params: {
      Bucket: getBucketName(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      ContentLength: opts.contentLength,
      ACL: "public-read",
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  });
  await upload.done();
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: getBucketName(), Key: key });
  return getSignedUrl(client(), cmd, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: key }));
}

export function publicUrlFor(key: string): string | null {
  if (!endpoint || !bucketName) return null;
  const base = endpoint.replace(/\/+$/, "");
  return `${base}/${bucketName}/${key}`;
}
