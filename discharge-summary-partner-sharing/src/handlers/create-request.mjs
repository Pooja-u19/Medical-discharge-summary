import { responseHelper, envHelper } from "../helpers/index.mjs";
import { s3Service, dynamoDBService } from "../services/index.mjs";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.mjs";

const pdfFileType = "application/pdf";
const pdfMaxSize = envHelper.getIntEnv("PDF_MAX_SIZE", 5 * 1024 * 1024);
const requestsTable = envHelper.getStringEnv("REQUESTS_DYNAMODB_TABLE");

export const handler = async (event) => {
  logger.info("create request lambda triggered");
  logger.debug(`event received :: ${JSON.stringify(event)}`);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: ''
    };
  }

  try {
    const request = JSON.parse(event.body);
    if (!request || !request.files || request.files.length === 0) {
      logger.warn("at least one document is required");
      return responseHelper.clientErrorResponse(
        "at least one document must be uploaded"
      );
    }

    const requiredTypes = ["other_documents"];
    for (const type of requiredTypes) {
      const file = request.files.find((f) => f.documentType === type);

      if (!file) {
        logger.warn(`missing mandatory document type :: ${type}`);
        return responseHelper.clientErrorResponse(
          `missing mandatory document: ${type}`
        );
      }

      if (!file.documentType) {
        logger.warn(`missing documentType for document :: ${type}`);
        return responseHelper.clientErrorResponse(
          `documentType is required for ${type}`
        );
      }

      if (!file.contentType) {
        logger.warn(`missing contentType for document type :: ${type}`);
        return responseHelper.clientErrorResponse(
          `contentType is required for ${type}`
        );
      }

      if (file.size === undefined || file.size === null) {
        logger.warn(`missing size for document type :: ${type}`);
        return responseHelper.clientErrorResponse(
          `size is required for ${type}`
        );
      }
    }

    const requestId = uuidv4();
    const presignedUrls = [];

    for (const documentFile of request.files) {
      const { contentType, size, documentType } = documentFile;

      if (documentType === "other_documents") {
        if (contentType !== pdfFileType) {
          logger.warn(
            `invalid file type for other_documents :: ${contentType}`
          );
          return responseHelper.clientErrorResponse(
            "other_documents must be a pdf file."
          );
        }
        if (size > pdfMaxSize) {
          logger.warn("other_documents size exceeds the 5mb limit");
          return responseHelper.clientErrorResponse(
            "other_documents must be under 5mb."
          );
        }
      } else {
        logger.warn(`invalid document type provided :: ${documentType}`);
        return responseHelper.clientErrorResponse(
          "invalid document type. allowed: xray, patient_doctor_image, other_documents."
        );
      }

      const documentId = uuidv4();
      const presignedUrl = await s3Service.generatePresignedUrl(
        `input/${requestId}/${documentType}/${documentId}`,
        3600,
        "putObject",
        contentType
      );
      logger.info(`generated presigned url for document :: ${documentId}`);

      presignedUrls.push({
        documentId,
        presignedUrl,
        documentType,
      });
    }

    // Save request to DynamoDB
    await dynamoDBService.putItem({
      TableName: requestsTable,
      Item: {
        requestId,
        createdAt: new Date().toISOString(),
        status: "PENDING"
      }
    });

    return responseHelper.successResponse(
      "documents submission requested successfully",
      {
        presignedUrls,
        requestId,
      }
    );
  } catch (error) {
    logger.error(`error in upload handler :: ${error.message}`);
    return responseHelper.serverErrorResponse(
      "an error occurred while requesting document submission"
    );
  }
};
