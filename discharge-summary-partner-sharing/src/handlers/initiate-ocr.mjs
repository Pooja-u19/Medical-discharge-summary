import { documentStatus } from "../constants/index.mjs";
import { envHelper } from "../helpers/index.mjs";
import {
  dynamoDBService,
  textractService,
  s3Service,
  snsService,
} from "../services/index.mjs";
import { cryptoHelper } from "../helpers/index.mjs";
import logger from "../utils/logger.mjs";
import { v4 as uuidv4 } from "uuid";

const imageFileTypes = ["image/jpeg", "image/png", "image/tiff"];
const pdfFileType = "application/pdf";
const imageMaxSize = envHelper.getIntEnv("IMAGE_MAX_SIZE", 5 * 1024 * 1024);
const pdfMaxSize = envHelper.getIntEnv("PDF_MAX_SIZE", 5 * 1024 * 1024);
const bucketName = envHelper.getStringEnv("DOCUMENTS_S3_BUCKET");
const documentsTable = envHelper.getStringEnv("DOCUMENTS_DYNAMODB_TABLE");
const requestsTable = envHelper.getStringEnv("REQUESTS_DYNAMODB_TABLE");

export const handler = async (event) => {
  logger.info("initiate ocr lambda triggered");
  logger.debug(`event received :: ${JSON.stringify(event)}`);

  try {
    const documentsToProcess = await Promise.all(
      event.Records.map(processDocument)
    );
    if (documentsToProcess.length > 0) {
      await dynamoDBService.batchWrite({
        TableName: documentsTable,
        Items: documentsToProcess,
      });
    }
  } catch (error) {
    logger.error(`error processing records :: ${error.message}`);
    throw error;
  }
};

const processDocument = async (record) => {
  const s3Event = JSON.parse(record.body);
  const objectKey = s3Event.detail.object.key;
  let [, requestId, documentType, documentId] = objectKey.split("/");

  if (!isValidUUID(requestId) || !isValidUUID(documentId)) {
    logger.debug(
      `invalid requestId or documentId :: ${requestId} :: ${documentId}`
    );
    requestId = uuidv4();
    documentId = uuidv4();
  }

  const document = {
    documentId,
    requestId,
    documentStatus: documentStatus.PENDING,
    documentS3Path: objectKey,
    documentType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const logPrefix = `processing record :: requestId :: ${requestId} :: documentType :: ${documentType} :: documentId :: ${documentId}`;
  try {
    logger.info(logPrefix);

    const fileData = await s3Service.getObject(objectKey);
    const documentHash = await cryptoHelper.generateDocumentHash(fileData.Body);
    document.documentHash = documentHash;

    if (![...imageFileTypes, pdfFileType].includes(fileData.ContentType)) {
      return handleInvalidFile(document, "invalid file type");
    }

    const maxSize =
      fileData.ContentType === pdfFileType ? pdfMaxSize : imageMaxSize;
    if (fileData.ContentLength > maxSize) {
      return handleInvalidFile(
        document,
        `${fileData.ContentType} file size exceeds the ${
          maxSize / (1024 * 1024)
        }MB limit`
      );
    }

    await dynamoDBService.putItem({
      TableName: requestsTable,
      Item: {
        requestId: document.requestId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    if (documentType === "other_documents")
      await initiateTextractTextDetection(document, objectKey);
    return document;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message}`);
    return {
      ...document,
      documentStatus: documentStatus.ERROR,
      errorMessage: error.message,
    };
  }
};

const handleInvalidFile = (document, errorMessage) => {
  logger.warn(`handleInvalidFile :: error :: ${errorMessage}`);
  document.documentStatus = documentStatus.ERROR;
  document.errorMessage = errorMessage;
  return document;
};

const handleDuplicateDocument = async (document, existingDocument) => {
  logger.warn(
    `handleDuplicateDocument :: document already exists with the same hash`
  );
  document.documentStatus = documentStatus.SUSPICIOUS;
  document.errorMessage =
    existingDocument.documentStatus === documentStatus.SUSPICIOUS
      ? existingDocument.errorMessage || "document already exists"
      : "document already exists";
  document.matchedDocumentId = existingDocument.documentId;

  await snsService.publishToSNS(
    `The document with ID '${document.documentId}' under request ID '${document.requestId}' has been flagged as fraudulent. It exactly matches document ID '${document.matchedDocumentId}'. Please review the details and take the necessary action.`,
    "SAST Fraud Detection Alerts"
  );

  return document;
};

const initiateTextractTextDetection = async (document, objectKey) => {
  const snsTopicArn = envHelper.getStringEnv(
    "NOTIFICATION_CHANNEL_SNS_TOPIC_ARN"
  );
  const roleArn = envHelper.getStringEnv("NOTIFICATION_CHANNEL_ROLE_ARN");

  const params = {
    DocumentLocation: {
      S3Object: { Bucket: bucketName, Name: decodeURIComponent(objectKey) },
    },
    NotificationChannel: { RoleArn: roleArn, SNSTopicArn: snsTopicArn },
  };

  const textractResult = await textractService.startDocumentTextDetection(
    params
  );
  logger.debug(
    `initiateTextractTextDetection :: textract asynchronous job started with jobId :: ${textractResult.JobId}`
  );
};

const isValidUUID = (str) => {
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
};
