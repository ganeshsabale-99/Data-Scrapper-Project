import { S3Client } from "@aws-sdk/client-s3";

export const getRequiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    const err: any = new Error(`Missing required environment variable: ${key}`);
    err.status = 500;
    throw err;
  }
  return value;
};

export const getS3Client = () => {
  const region = getRequiredEnv("AWS_REGION");
  const accessKeyId = getRequiredEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("AWS_SECRET_ACCESS_KEY");

  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
};

export const getS3BucketName = () => getRequiredEnv("AWS_S3_BUCKET_NAME");
