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
  logger.info("InitiateOCR Lambda triggered by SQS from EventBridge");
  logger.debug(`Full event received: ${JSON.stringify(event, null, 2)}`);

  try {
    for (const record of event.Records) {
      // Parse the SQS message body which contains the EventBridge event
      const eventBridgeEvent = JSON.parse(record.body);
      logger.info(`Processing EventBridge event: ${JSON.stringify(eventBridgeEvent, null, 2)}`);
      
      // Extract S3 event details from EventBridge event
      const bucketName = eventBridgeEvent.detail.bucket.name;
      const objectKey = eventBridgeEvent.detail.object.key;
      
      logger.info(`Processing S3 object: ${objectKey} from bucket: ${bucketName}`);
      
      // Create a mock S3 record for compatibility with existing processS3Document function
      const mockS3Record = {
        eventName: 'ObjectCreated:Put',
        s3: {
          bucket: { name: bucketName },
          object: { 
            key: objectKey,
            size: eventBridgeEvent.detail.object.size || 0
          }
        }
      };
      
      const document = await processS3Document(mockS3Record);
      if (document) {
        await dynamoDBService.putItem({
          TableName: documentsTable,
          Item: document,
        });
        logger.info(`Document ${document.documentId} saved to DynamoDB`);
      }
    }
  } catch (error) {
    logger.error(`Error processing SQS records from EventBridge: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    throw error;
  }
};

const processS3Document = async (record) => {
  const objectKey = decodeURIComponent(record.s3.object.key);
  console.log(`📂 INITIATE-OCR: Processing S3 object key = ${objectKey}`);
  logger.info(`📂 INITIATE-OCR: Processing S3 object key = ${objectKey}`);
  
  let [, requestId, documentType, documentId] = objectKey.split("/");
  console.log(`🔍 INITIATE-OCR: Extracted from S3 path - requestId = ${requestId}, documentId = ${documentId}, documentType = ${documentType}`);
  logger.info(`🔍 INITIATE-OCR: Extracted from S3 path - requestId = ${requestId}, documentId = ${documentId}, documentType = ${documentType}`);

  if (!isValidUUID(requestId) || !isValidUUID(documentId)) {
    console.log(`⚠️ INITIATE-OCR: Invalid UUIDs detected, generating new ones`);
    logger.debug(
      `Invalid requestId or documentId: ${requestId} :: ${documentId}`
    );
    requestId = uuidv4();
    documentId = uuidv4();
    console.log(`🆕 INITIATE-OCR: Generated new requestId = ${requestId}, documentId = ${documentId}`);
    logger.info(`🆕 INITIATE-OCR: Generated new requestId = ${requestId}, documentId = ${documentId}`);
  }

  // Get patient ID from request
  let patientId = null;
  try {
    const requestData = await dynamoDBService.getItem({
      TableName: requestsTable,
      Key: { requestId }
    });
    patientId = requestData.Item?.patientId || uuidv4();
  } catch (error) {
    logger.warn(`Could not retrieve patientId for requestId ${requestId}, generating new one`);
    patientId = uuidv4();
  }

  const document = {
    documentId,
    requestId,
    patientId,
    documentStatus: documentStatus.PENDING,
    documentS3Path: objectKey,
    documentType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  console.log(`📝 INITIATE-OCR: Created document object with requestId = ${requestId}, documentId = ${documentId}`);
  logger.info(`📝 INITIATE-OCR: Created document object with requestId = ${requestId}, documentId = ${documentId}`);

  const logPrefix = `Processing record :: requestId: ${requestId} :: documentType: ${documentType} :: documentId: ${documentId}`;
  try {
    logger.info(logPrefix);

    const fileData = await s3Service.getObject(objectKey);
    const documentHash = await cryptoHelper.generateDocumentHash(fileData.Body);
    document.documentHash = documentHash;

    logger.info(`File details - ContentType: ${fileData.ContentType}, Size: ${fileData.ContentLength}`);

    if (![...imageFileTypes, pdfFileType].includes(fileData.ContentType)) {
      return handleInvalidFile(document, "Invalid file type");
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

    // Check for duplicate documents
    const existingDocuments = await dynamoDBService.scan({
      TableName: documentsTable,
      FilterExpression: "documentHash = :hash",
      ExpressionAttributeValues: {
        ":hash": documentHash,
      },
      Limit: 1
    });

    if (existingDocuments.Items && existingDocuments.Items.length > 0) {
      return await handleDuplicateDocument(document, existingDocuments.Items[0]);
    }

    // Create or update request record with patient ID
    await dynamoDBService.putItem({
      TableName: requestsTable,
      Item: {
        requestId: document.requestId,
        patientId: document.patientId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "PROCESSING"
      },
    });

    // Only process documents in the "other_documents" folder for OCR
    if (documentType === "other_documents") {
      const jobId = await initiateTextractTextDetection(document, objectKey);
      document.textractJobId = jobId;
      logger.info(`Textract job ${jobId} initiated for document ${documentId}`);
    } else {
      logger.info(`Document type ${documentType} does not require OCR processing`);
    }
    
    return document;
  } catch (error) {
    logger.error(`${logPrefix} :: error: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    return {
      ...document,
      documentStatus: documentStatus.ERROR,
      errorMessage: error.message,
    };
  }
};

const handleInvalidFile = (document, errorMessage) => {
  logger.warn(`Invalid file: ${errorMessage}`);
  document.documentStatus = documentStatus.ERROR;
  document.errorMessage = errorMessage;
  return document;
};

const handleDuplicateDocument = async (document, existingDocument) => {
  logger.info(
    `Duplicate document detected - reusing existing document ${existingDocument.documentId}`
  );
  
  // Always reuse existing document data - no fraud alerts for legitimate reuse
  document.documentStatus = documentStatus.LEGITIMATE;
  document.textractJobId = existingDocument.textractJobId;
  document.extractedText = existingDocument.extractedText;
  document.summary = existingDocument.summary;
  document.pages = existingDocument.pages;
  document.matchedDocumentId = existingDocument.documentId;
  document.reuseExisting = true;
  
  logger.info(`Reusing existing document ${existingDocument.documentId} for new request ${document.requestId}`);
  
  // Update request status to completed since we're reusing existing data
  try {
    await dynamoDBService.putItem({
      TableName: requestsTable,
      Item: {
        requestId: document.requestId,
        patientId: document.patientId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "COMPLETED"
      },
    });
  } catch (error) {
    logger.error(`Failed to update request status for reused document: ${error.message}`);
  }
  
  return document;
};

const initiateTextractTextDetection = async (document, objectKey) => {
  const snsTopicArn = envHelper.getStringEnv(
    "NOTIFICATION_CHANNEL_SNS_TOPIC_ARN"
  );
  const roleArn = envHelper.getStringEnv("NOTIFICATION_CHANNEL_ROLE_ARN");

  logger.info(`Initiating Textract with SNS topic: ${snsTopicArn} and role: ${roleArn}`);

  const params = {
    DocumentLocation: {
      S3Object: { Bucket: bucketName, Name: decodeURIComponent(objectKey) },
    },
    NotificationChannel: { RoleArn: roleArn, SNSTopicArn: snsTopicArn },
  };

  try {
    const textractResult = await textractService.startDocumentTextDetection(
      params
    );
    logger.info(
      `Textract asynchronous job started with jobId: ${textractResult.JobId}`
    );
    
    // Update document with Textract job ID
    await dynamoDBService.updateItem({
      Key: { documentId: document.documentId },
      TableName: documentsTable,
      UpdateExpression: "SET textractJobId = :jobId, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":jobId": textractResult.JobId,
        ":updatedAt": new Date().toISOString(),
      },
    });
    
    logger.info(`Document ${document.documentId} updated with textractJobId: ${textractResult.JobId}`);
    return textractResult.JobId;
  } catch (error) {
    logger.error(`Failed to initiate Textract: ${error.message}`);
    logger.error(`Textract error stack: ${error.stack}`);
    throw error;
  }
};

const isValidUUID = (str) => {
  const regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
};