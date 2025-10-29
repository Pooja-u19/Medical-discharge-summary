import { documentStatus, textractStatus } from "../constants/index.mjs";
import { envHelper } from "../helpers/index.mjs";
import {
  bedrockService,
  dynamoDBService,
  snsService,
  textractService,
} from "../services/index.mjs";
import logger from "../utils/logger.mjs";

const documentsTable = envHelper.getStringEnv("DOCUMENTS_DYNAMODB_TABLE");
const requestsTable = envHelper.getStringEnv("REQUESTS_DYNAMODB_TABLE");
const modelId = envHelper.getStringEnv(
  "BEDROCK_MODEL_ID",
  "amazon.nova-lite-v1:0"
);

export const handler = async (event) => {
  logger.info("GenerateSummary Lambda triggered by SQS from SNS");
  logger.debug(`Full event received: ${JSON.stringify(event, null, 2)}`);

  for (const record of event.Records) {
    let textractJobId, textractJobStatus;
    
    try {
      // Parse the SQS message body which contains the SNS message
      const messageBody = JSON.parse(record.body);
      logger.debug(`SQS message body: ${JSON.stringify(messageBody, null, 2)}`);
      
      const snsMessage = JSON.parse(messageBody.Message);
      logger.debug(`SNS message: ${JSON.stringify(snsMessage, null, 2)}`);
      
      textractJobId = snsMessage.JobId;
      textractJobStatus = snsMessage.Status;
      
      logger.info(`Processing Textract job: ${textractJobId} with status: ${textractJobStatus}`);
    } catch (parseError) {
      logger.error(`Failed to parse SQS/SNS message: ${parseError.message}`);
      logger.error(`Parse error stack: ${parseError.stack}`);
      continue;
    }

    // Get document info from DynamoDB using textract job ID
    logger.info(`Searching for document with textractJobId: ${textractJobId}`);
    
    const queryParams = {
      TableName: documentsTable,
      IndexName: "TextractJobIdIndex",
      KeyConditionExpression: "textractJobId = :jobId",
      ExpressionAttributeValues: {
        ":jobId": textractJobId,
      },
      Limit: 1
    };
    
    logger.info(`Query parameters: ${JSON.stringify(queryParams)}`);
    
    let documents;
    try {
      documents = await dynamoDBService.query(queryParams);
      logger.info(`Query result: Found ${documents.Items ? documents.Items.length : 0} documents`);
    } catch (queryError) {
      logger.error(`DynamoDB query failed: ${queryError.message}`);
      logger.error(`Query error stack: ${queryError.stack}`);
      
      // Fallback to scan if GSI is not available yet
      logger.info(`Falling back to scan operation...`);
      try {
        const scanParams = {
          TableName: documentsTable,
          FilterExpression: "textractJobId = :jobId",
          ExpressionAttributeValues: {
            ":jobId": textractJobId,
          }
        };
        documents = await dynamoDBService.scan(scanParams);
        logger.info(`Fallback scan result: Found ${documents.Items ? documents.Items.length : 0} documents`);
      } catch (scanError) {
        logger.error(`Fallback scan also failed: ${scanError.message}`);
        continue;
      }
    }
    
    if (documents.Items && documents.Items.length > 0) {
      logger.info(`Found document: ${documents.Items[0].documentId}`);
    } else {
      logger.error(`No documents found with textractJobId: ${textractJobId}`);
      logger.info(`Attempting diagnostic scan...`);
      
      // Diagnostic scan to understand table state
      try {
        const allDocs = await dynamoDBService.scan({
          TableName: documentsTable,
          Limit: 10,
          ProjectionExpression: "documentId, textractJobId, documentStatus, createdAt"
        });
        logger.info(`Total documents in table: ${allDocs.Items ? allDocs.Items.length : 0}`);
        if (allDocs.Items && allDocs.Items.length > 0) {
          allDocs.Items.forEach((doc, index) => {
            logger.info(`Document ${index + 1}: ID=${doc.documentId}, TextractJobId=${doc.textractJobId || 'null'}, Status=${doc.documentStatus}`);
          });
        }
      } catch (diagnosticError) {
        logger.error(`Diagnostic scan failed: ${diagnosticError.message}`);
      }
    }
    
    if (!documents.Items || documents.Items.length === 0) {
      logger.warn(`No document found for Textract jobId: ${textractJobId}`);
      logger.error(`CRITICAL: Document lookup failed - document may not exist or textractJobId not set properly`);
      continue;
    }
    
    const document = documents.Items[0];
    const requestId = document.requestId;
    const documentId = document.documentId;
    const logPrefix = `Processing :: requestId: ${requestId} :: documentId: ${documentId} :: jobId: ${textractJobId} :: status: ${textractJobStatus}`;

    try {
      logger.info(logPrefix);

      if (textractJobStatus === textractStatus.SUCCEEDED) {
        logger.info(`${logPrefix} :: Textract job succeeded, retrieving results`);
        
        const pages = await textractService.getDocumentTextDetectionResults(
          textractJobId
        );

        logger.info(`${logPrefix} :: Retrieved ${pages.length} pages of text`);

        const medicalInformation = await getMedicalInformation(pages);
        if (
          !medicalInformation?.data ||
          Object.values(medicalInformation.data).every((value) => value.summarizedText === "")
        ) {
          logger.warn(
            `${logPrefix} :: No relevant medical information found in extracted text`
          );
          await updateDocumentItem(
            documentId,
            documentStatus.ERROR,
            null,
            null,
            "No relevant medical information found in document"
          );
          await updateRequestStatus(requestId, "FAILED");
          await snsService.publishToSNS(
            `No medical information found in document for Request ${requestId}`,
            "Document Processing Alert"
          );
          continue;
        }

        logger.info(`${logPrefix} :: Medical information extracted successfully`);
        logger.debug(
          `${logPrefix} :: Medical information: ${JSON.stringify(
            medicalInformation,
            null,
            2
          )}`
        );

        // Get all documents for this request
        const requestDocuments = await dynamoDBService.query({
          TableName: documentsTable,
          IndexName: "RequestIdIndex",
          KeyConditionExpression: "requestId = :requestId",
          ExpressionAttributeValues: {
            ":requestId": requestId,
          },
        });

        if (requestDocuments.Count === 0) {
          logger.warn(`${logPrefix} :: No documents found for request`);
          continue;
        }

        logger.info(`${logPrefix} :: Found ${requestDocuments.Count} documents for request`);

        // Update the current document
        await updateDocumentItem(
          documentId,
          documentStatus.LEGITIMATE,
          pages,
          medicalInformation.data
        );
        
        await updateRequestStatus(requestId, "COMPLETED");
        
        await snsService.publishToSNS(
          `✅ Discharge Summary Generated Successfully!\n\nRequest ID: ${requestId}\nDocument ID: ${documentId}\nProcessing completed at: ${new Date().toISOString()}\n\nThe medical document has been processed and the discharge summary is ready for review.`,
          "Discharge Summary - Processing Complete"
        );

        logger.info(`${logPrefix} :: Processing completed successfully`);

      } else if (textractJobStatus === textractStatus.FAILED) {
        logger.error(`${logPrefix} :: Textract job failed`);
        await updateDocumentItem(
          documentId,
          documentStatus.ERROR,
          null,
          null,
          "Text extraction failed"
        );
        await updateRequestStatus(requestId, "FAILED");
        await snsService.publishToSNS(
          `❌ Text Extraction Failed\n\nRequest ID: ${requestId}\nDocument ID: ${documentId}\nError: Textract job failed\nTime: ${new Date().toISOString()}`,
          "Document Processing Error"
        );
      } else {
        logger.info(`${logPrefix} :: Textract job status: ${textractJobStatus} - no action needed`);
      }
    } catch (error) {
      logger.error(`${logPrefix} :: Processing error: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      
      await updateDocumentItem(documentId, documentStatus.ERROR, null, null, error.message);
      await updateRequestStatus(requestId, "FAILED");
      await snsService.publishToSNS(
        `❌ Document Processing Error\n\nRequest ID: ${requestId}\nDocument ID: ${documentId}\nError: ${error.message}\nTime: ${new Date().toISOString()}`,
        "Document Processing Error"
      );
    }
  }
};

const updateDocumentItem = async (
  documentId,
  documentStatus,
  pages = null,
  summary = null,
  errorMessage = null
) => {
  const updateExpressions = [
    "SET updatedAt = :updatedAt",
    "documentStatus = :documentStatus",
  ];
  const expressionAttributeValues = {
    ":updatedAt": new Date().toISOString(),
    ":documentStatus": documentStatus,
  };

  if (errorMessage) {
    updateExpressions.push("errorMessage = :errorMessage");
    expressionAttributeValues[":errorMessage"] = errorMessage;
  }

  if (pages !== null) {
    updateExpressions.push("pages = :pages");
    expressionAttributeValues[":pages"] = pages;
  }

  if (summary !== null) {
    updateExpressions.push("summary = :summary");
    expressionAttributeValues[":summary"] = summary;
  }

  const params = {
    Key: {
      documentId,
    },
    TableName: documentsTable,
    UpdateExpression: updateExpressions.join(", "),
    ExpressionAttributeValues: expressionAttributeValues,
  };

  const logPrefix = `Updating document :: documentId: ${documentId} :: status: ${documentStatus}`;
  try {
    await dynamoDBService.updateItem(params);
    logger.info(`${logPrefix} :: Document updated successfully`);
  } catch (error) {
    logger.error(`${logPrefix} :: Document update failed: ${error.message}`);
    throw error;
  }
};

const getMedicalInformation = async (pagesArray) => {
  const logPrefix = `getMedicalInformation`;
  try {
    logger.info(`${logPrefix} :: Processing ${pagesArray.length} pages for medical information extraction`);
    
    const formattedPages = pagesArray
      .map((page, index) => `Page ${index + 1}: ${page}`)
      .join("\n\n");

    const requiredFields = [
      "patientName",
      "age",
      "gender",
      "admittingDoctor",
      "ipNo",
      "summaryNumber",
      "admissionDate",
      "dischargeDate",
      "diagnosis",
      "presentingComplaints",
      "pastHistory",
      "systemicExamination",
      "keyInvestigationSummary",
      "hospitalCourse",
      "hospitalizationTreatment",
      "dischargeTreatment",
      "advice",
      "preventiveCare",
      "obtainUrgentCare",
    ];

    // Simple extraction without complex prompting
    const extractedText = formattedPages.substring(0, 2000); // First 2000 chars for testing
    
    // Create mock response with actual extracted text for testing
    const mockResponse = {
      data: {
        patientName: { summarizedText: "Patient Name Not Found" },
        age: { summarizedText: "Age Not Found" },
        gender: { summarizedText: "Gender Not Found" },
        admittingDoctor: { summarizedText: "Doctor Not Found" },
        ipNo: { summarizedText: "IP Number Not Found" },
        summaryNumber: { summarizedText: "Summary Number Not Found" },
        admissionDate: { summarizedText: "Admission Date Not Found" },
        dischargeDate: { summarizedText: "Discharge Date Not Found" },
        diagnosis: { summarizedText: extractedText || "Medical diagnosis extracted from document" },
        presentingComplaints: { summarizedText: "Presenting complaints not found" },
        pastHistory: { summarizedText: "Past history not found" },
        systemicExamination: { summarizedText: "Systemic examination not found" },
        keyInvestigationSummary: { summarizedText: "Investigation summary not found" },
        hospitalCourse: { summarizedText: "Hospital course not found" },
        hospitalizationTreatment: { summarizedText: "Hospitalization treatment not found" },
        dischargeTreatment: { summarizedText: "Discharge treatment not found" },
        advice: { summarizedText: "Advice not found" },
        preventiveCare: { summarizedText: "Preventive care not found" },
        obtainUrgentCare: { summarizedText: "Urgent care instructions not found" }
      }
    };
    
    logger.info(`${logPrefix} :: Using mock response for testing - extracted text length: ${extractedText.length}`);
    return mockResponse;

    // Bedrock processing commented out for testing
    // const response = await bedrockService.invokeBedrockModel(modelId, prompt);
    // return parsedResponse;
  } catch (error) {
    logger.error(`${logPrefix} :: Error extracting medical information: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    throw error;
  }
};

const updateRequestStatus = async (requestId, status) => {
  const params = {
    Key: { requestId },
    TableName: requestsTable,
    UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: {
      ":status": status,
      ":updatedAt": new Date().toISOString(),
    },
  };

  try {
    await dynamoDBService.updateItem(params);
    logger.info(`Request ${requestId} status updated to ${status}`);
  } catch (error) {
    logger.error(`Failed to update request ${requestId} status: ${error.message}`);
    throw error;
  }
};