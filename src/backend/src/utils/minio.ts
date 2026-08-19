import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000';
const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';

export const bucketName = process.env.MINIO_BUCKET_NAME || 'stock-inventory';

// MinIO is S3-compatible. We must enable forcePathStyle for local endpoints.
export const minioClient = new S3Client({
  endpoint: minioEndpoint,
  credentials: {
    accessKeyId: minioAccessKey,
    secretAccessKey: minioSecretKey,
  },
  region: 'us-east-1', // Placeholder region required by S3 SDK
  forcePathStyle: true,
});

export async function uploadImage(key: string, body: Buffer, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  
  return minioClient.send(command);
}

export async function getImageUrl(key: string) {
  // Returns path style URL directly pointing to local MinIO instance
  return `${minioEndpoint}/${bucketName}/${key}`;
}
