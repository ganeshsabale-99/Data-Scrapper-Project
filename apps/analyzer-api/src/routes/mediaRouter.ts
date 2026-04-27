import { Router } from "express";
import multer from "multer";
import { uploadNewTechParkExteriorMedia } from "../controller/mediaController";
import { checkPermission } from "../middleware/auth";

export const mediaRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 5,
    fileSize: 10 * 1024 * 1024,
  },
});

mediaRouter.post(
  "/new-techpark/exterior",
  checkPermission(["TECHPARKS.MANAGE", "COWORKING.MANAGE"], {
    mode: "any",
  }),
  upload.array("files", 5),
  uploadNewTechParkExteriorMedia,
);
