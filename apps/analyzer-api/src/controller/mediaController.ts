import type { Request, Response } from "express";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { getS3BucketName, getS3Client, getRequiredEnv } from "../libs/s3";
import { sendSafeErrorResponse } from "../utils/safeErrorResponse";

const encodeS3KeyForUrl = (key: string) =>
  key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const buildS3ObjectUrl = (bucket: string, region: string, key: string) =>
  `https://${bucket}.s3.${region}.amazonaws.com/${encodeS3KeyForUrl(key)}`;

export const uploadNewTechParkExteriorMedia = async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "At least 1 photo is required." });
  }
  if (files.length > 5) {
    return res.status(400).json({ error: "Maximum 5 photos are allowed." });
  }

  const invalid = files.find((f) => !f.mimetype?.startsWith("image/"));
  if (invalid) {
    return res.status(400).json({
      error: `Only image uploads are supported. Invalid file type: ${invalid.mimetype || "unknown"}`,
    });
  }

  const s3 = getS3Client();
  const bucket = getS3BucketName();
  const region = getRequiredEnv("AWS_REGION");

  const now = new Date();
  const prefix = [
    "new-techparks",
    "exterior",
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("/");

  try {
    const uploads = await Promise.all(
      files.map(async (file) => {
        const ext = (() => {
          const name = file.originalname || "";
          const idx = name.lastIndexOf(".");
          if (idx === -1) return "";
          const e = name.slice(idx).toLowerCase();
          if (e.length > 10) return "";
          return e;
        })();

        const key = `${prefix}/${crypto.randomUUID()}${ext}`;

        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );

        const url = buildS3ObjectUrl(bucket, region, key);
        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: bucket, Key: key }),
          { expiresIn: 60 * 60 * 24 * 7 }, // 7 days
        );

        return {
          key,
          url,
          signedUrl,
          contentType: file.mimetype,
          size: file.size,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      files: uploads,
      urls: uploads.map((u) => u.url),
      signedUrls: uploads.map((u) => u.signedUrl),
      keys: uploads.map((u) => u.key),
    });
  } catch (error: any) {
    return sendSafeErrorResponse(
      res,
      error,
      "media.uploadNewTechParkExteriorMedia",
      "Failed to upload photos right now. Please try again.",
    );
  }
};


