import { envHelper } from "../helpers/index.mjs";
import AWS from "aws-sdk";
import logger from "../utils/logger.mjs";

const s3 = new AWS.S3({
  signatureVersion: 'v4'
});
const bucketName = envHelper.getStringEnv("DOCUMENTS_S3_BUCKET");
const kmsKeyId = envHelper.getStringEnv("KMS_KEY_ID");
const presignedUrlExpiration = envHelper.getIntEnv(
  "PRESIGNED_URL_EXPIRATION",
  300
);

export const getObject = async (key) => {
  const params = {
    Bucket: bucketName,
    Key: key,
  };

  const logPrefix = `s3Service :: getObject :: params :: ${JSON.stringify(
    params
  )}`;
  try {
    logger.info(logPrefix);
    const data = await s3.getObject(params).promise();
    logger.debug(`${logPrefix} :: File retrieved successfully`);
    return data;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message} :: ${error}`);
    throw error;
  }
};

export const generatePresignedUrl = async (
  key,
  expiresIn = presignedUrlExpiration,
  operation = "getObject",
  contentType = null
) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expiresIn,
  };
  
  // Add content type for PUT operations
  if (operation === "putObject" && contentType) {
    params.ContentType = contentType;
  }

  const logPrefix = `s3Service :: generatePresignedUrl :: ${JSON.stringify(
    params
  )} :: operation :: ${operation}`;
  try {
    logger.info(logPrefix);
    const presignedUrl = await s3.getSignedUrlPromise(operation, params);
    logger.debug(`${logPrefix} :: presigned url generated successfully`);
    return presignedUrl;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message} :: ${error}`);
    throw error;
  }
};
