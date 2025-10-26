import crypto from "crypto";
import { getStringEnv } from "./envHelper.mjs";

const algorithm = getStringEnv("HASH_ALGORITHM", "sha256");

export const generateDocumentHash = (fileBuffer) => {
  const hash = crypto.createHash(algorithm);
  hash.update(fileBuffer);
  return hash.digest("hex");
};