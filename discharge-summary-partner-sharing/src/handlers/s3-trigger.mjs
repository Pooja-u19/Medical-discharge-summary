import { envHelper } from "../helpers/index.mjs";
import { textractService, dynamoDBService } from "../services/index.mjs";
import logger from "../utils/logger.mjs";

const bucketName = envHelper.getStringEnv("DOCUMENTS_S3_BUCKET");
const documentsTable = envHelper.getStringEnv("DOCUMENTS_DYNAMODB_TABLE");

export const handler = async (event) => {
  logger.info("S3 trigger lambda activated");
  
  for (const record of event.Records) {
    if (record.eventName.startsWith('ObjectCreated')) {
      const objectKey = decodeURIComponent(record.s3.object.key);
      const [, requestId, documentType, documentId] = objectKey.split("/");
      
      logger.info(`Processing S3 object: ${objectKey}`);
      
      try {
        // Create document record
        await dynamoDBService.putItem({
          TableName: documentsTable,
          Item: {
            documentId,
            requestId,
            documentStatus: 0, // PENDING
            documentS3Path: objectKey,
            documentType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        });

        // Start Textract immediately
        if (documentType === "other_documents") {
          const snsTopicArn = envHelper.getStringEnv("NOTIFICATION_CHANNEL_SNS_TOPIC_ARN");
          const roleArn = envHelper.getStringEnv("NOTIFICATION_CHANNEL_ROLE_ARN");

          const params = {
            DocumentLocation: {
              S3Object: { Bucket: bucketName, Name: objectKey }
            },
            NotificationChannel: { RoleArn: roleArn, SNSTopicArn: snsTopicArn }
          };

          const result = await textractService.startDocumentTextDetection(params);
          logger.info(`Textract job started: ${result.JobId}`);
        }
        
      } catch (error) {
        logger.error(`Error processing ${objectKey}: ${error.message}`);
      }
    }
  }
};