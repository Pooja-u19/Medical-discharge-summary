import { dynamoDBService, s3Service } from "../services/index.mjs";
import { envHelper, responseHelper } from "../helpers/index.mjs";
import logger from "../utils/logger.mjs";

const documentsTable = envHelper.getStringEnv("DOCUMENTS_DYNAMODB_TABLE");
const requestsTable = envHelper.getStringEnv("REQUESTS_DYNAMODB_TABLE");

export const handler = async (event) => {
  logger.info("get request lambda triggered");
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

  const { requestId } = event.pathParameters || {};
  if (!requestId) {
    logger.warn("missing required parameter :: requestId");
    return responseHelper.clientErrorResponse("requestId is required");
  }

  try {
    const requests = await dynamoDBService.query({
      TableName: requestsTable,
      KeyConditionExpression: "requestId = :requestId",
      ExpressionAttributeValues: {
        ":requestId": requestId,
      },
    });

    const request = requests.Items[0];

    const documents = await dynamoDBService.query({
      TableName: documentsTable,
      IndexName: "RequestIdIndex",
      KeyConditionExpression: "requestId = :requestId",
      ExpressionAttributeValues: { ":requestId": requestId },
    });

    if (!documents || !documents.Items || documents.Items.length === 0) {
      logger.warn(`request with requestId :: ${requestId} does not exist`);
      return responseHelper.successResponse("request does not exists", null);
    }

    const results = await Promise.all(
      documents.Items.map(async (document) => {
        const result = {
          documentId: document.documentId,
          documentStatus: document.documentStatus,
          documentType: document.documentType,
          errorMessage: document.errorMessage || null,
          fraudProbability: document.fraudProbability || null,
          analysisSummary: document.analysisSummary || null,
          summary: document.summary || null,
          pages: document.pages || null,
          createdAt: document.createdAt || null,
          updatedAt: document.updatedAt || null
        };

        if (document.documentS3Path) {
          result.documentS3Path = await s3Service.generatePresignedUrl(
            document.documentS3Path
          );
        }

        if (document.matchedDocumentId) {
          const matchedDocumentResponse = await dynamoDBService.getItem({
            TableName: documentsTable,
            Key: { documentId: document.matchedDocumentId },
          });

          const matchedDocument = matchedDocumentResponse?.Item;
          if (matchedDocument && matchedDocument.documentS3Path) {
            result.matchedDocumentS3Path = await s3Service.generatePresignedUrl(
              matchedDocument.documentS3Path
            );
          }
        }

        return result;
      })
    );

    logger.debug(
      `successfully retrieved document statuses for requestId :: ${requestId} :: results :: ${JSON.stringify(
        results
      )}`
    );
    return responseHelper.successResponse("document Status Retrieved", {
      request,
      documents: results,
    });
  } catch (error) {
    logger.error(
      `error processing requestId :: ${requestId} :: error :: ${error.message} :: ${error}`,
      error
    );
    return responseHelper.serverErrorResponse(
      "an error occurred while retrieving document status"
    );
  }
};
