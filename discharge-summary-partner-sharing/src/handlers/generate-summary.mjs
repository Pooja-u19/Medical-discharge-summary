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
  logger.info("generate summary lambda triggered");
  logger.debug(`event received :: ${JSON.stringify(event)}`);

  for (const record of event.Records) {
    let textractJobId, textractJobStatus, requestId, documentId;
    
    try {
      const messageBody = JSON.parse(record.body);
      const message = JSON.parse(messageBody.Message);
      textractJobId = message.JobId;
      textractJobStatus = message.Status;
      const document = message.DocumentLocation.S3ObjectName;
      [, requestId, , documentId] = document.split("/");
      
      const logPrefix = `processing record :: requestId :: ${requestId} :: documentId :: ${documentId} :: jobId :: ${textractJobId} :: textractJobStatus :: ${textractJobStatus}`;

      if (textractJobStatus === textractStatus.SUCCEEDED) {
        const pages = await textractService.getDocumentTextDetectionResults(
          textractJobId
        );

        // Get the current document to find patient ID
        const currentDocument = await dynamoDBService.getItem({
          TableName: documentsTable,
          Key: { documentId }
        });

        if (!currentDocument.Item) {
          logger.warn(`${logPrefix} :: current document not found`);
          continue;
        }

        const patientId = currentDocument.Item.patientId;
        
        if (!patientId) {
          logger.warn(`${logPrefix} :: document missing patientId, processing individually`);
          // Process as individual document without patient grouping
          const medicalInformation = await getMedicalInformation(pages);
          await updateDocumentItem(
            documentId,
            documentStatus.LEGITIMATE,
            pages,
            medicalInformation.data
          );
          await updateRequestStatus(requestId, "COMPLETED");
          continue;
        }
        
        logger.info(`${logPrefix} :: processing for patientId :: ${patientId}`);

        // Store extracted text for this document
        await updateDocumentItem(
          documentId,
          documentStatus.LEGITIMATE,
          pages,
          null // Don't generate individual summary yet
        );

        // Check if all documents for this patient are processed
        const allPatientDocuments = await dynamoDBService.query({
          TableName: documentsTable,
          IndexName: "PatientIdIndex",
          KeyConditionExpression: "patientId = :patientId",
          ExpressionAttributeValues: {
            ":patientId": patientId
          }
        });

        const pendingDocuments = allPatientDocuments.Items.filter(
          doc => doc.documentStatus === documentStatus.PENDING
        );

        if (pendingDocuments.length === 0) {
          // All documents processed, generate combined summary
          logger.info(`${logPrefix} :: all documents processed for patient ${patientId}, generating combined summary`);
          
          const processedDocuments = allPatientDocuments.Items.filter(
            doc => doc.documentStatus === documentStatus.LEGITIMATE && doc.pages
          );

          if (processedDocuments.length > 0) {
            const combinedSummary = await generateCombinedPatientSummary(processedDocuments);
            
            // Update all documents with the combined summary
            for (const doc of processedDocuments) {
              await updateDocumentItem(
                doc.documentId,
                documentStatus.LEGITIMATE,
                doc.pages,
                combinedSummary.data
              );
            }

            // Update all requests for this patient
            const patientRequests = await dynamoDBService.query({
              TableName: requestsTable,
              IndexName: "PatientIdIndex",
              KeyConditionExpression: "patientId = :patientId",
              ExpressionAttributeValues: {
                ":patientId": patientId
              }
            });

            for (const request of patientRequests.Items) {
              await updateRequestStatus(request.requestId, "COMPLETED");
            }

            await snsService.publishToSNS(
              `✅ Combined Patient Summary Generated!\n\nPatient ID: ${patientId}\nDocuments Processed: ${processedDocuments.length}\nProcessing completed at: ${new Date().toISOString()}\n\nAll medical documents for this patient have been analyzed and a comprehensive summary is ready.`,
              "Patient Summary - Processing Complete"
            );
          }
        } else {
          logger.info(`${logPrefix} :: waiting for ${pendingDocuments.length} more documents to complete for patient ${patientId}`);
        }

      } else if (textractJobStatus === textractStatus.FAILED) {
        logger.warn(`${logPrefix} :: textract job failed`);
        await updateDocumentItem(
          documentId,
          documentStatus.ERROR,
          null,
          null,
          "text extraction failed"
        );
        await updateRequestStatus(requestId, "FAILED");
        await snsService.publishToSNS(
          `❌ Text Extraction Failed\n\nRequest ID: ${requestId}\nDocument ID: ${documentId}\nError: Textract job failed\nTime: ${new Date().toISOString()}`,
          "Document Processing Error"
        );
      } else {
        logger.info(`${logPrefix} :: textract job status: ${textractJobStatus} - no action needed`);
      }
    } catch (error) {
      const logPrefix = `processing error :: requestId :: ${requestId || 'unknown'} :: documentId :: ${documentId || 'unknown'}`;
      logger.error(`${logPrefix} :: error :: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      
      if (documentId) {
        try {
          await updateDocumentItem(documentId, documentStatus.ERROR, null, null, error.message);
        } catch (updateError) {
          logger.error(`Failed to update document ${documentId}: ${updateError.message}`);
        }
      }
      
      if (requestId) {
        try {
          await updateRequestStatus(requestId, "FAILED");
          await snsService.publishToSNS(
            `❌ Document Processing Error\n\nRequest ID: ${requestId}\nDocument ID: ${documentId || 'unknown'}\nError: ${error.message}\nTime: ${new Date().toISOString()}`,
            "Document Processing Error"
          );
        } catch (notificationError) {
          logger.error(`Failed to send error notification: ${notificationError.message}`);
        }
      }
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
  const setExpressions = [
    "updatedAt = :updatedAt",
    "documentStatus = :documentStatus",
  ];
  const removeExpressions = [];
  const expressionAttributeValues = {
    ":updatedAt": new Date().toISOString(),
    ":documentStatus": documentStatus,
  };

  if (errorMessage) {
    setExpressions.push("errorMessage = :errorMessage");
    expressionAttributeValues[":errorMessage"] = errorMessage;
  } else {
    // Remove error message if document is being marked as legitimate
    removeExpressions.push("errorMessage");
  }

  if (pages !== null) {
    setExpressions.push("pages = :pages");
    expressionAttributeValues[":pages"] = pages;
  }

  if (summary !== null) {
    setExpressions.push("summary = :summary");
    expressionAttributeValues[":summary"] = summary;
  }

  // Build the UpdateExpression
  let updateExpression = "";
  const params = {
    Key: {
      documentId,
    },
    TableName: documentsTable,
  };

  if (setExpressions.length > 0) {
    updateExpression += "SET " + setExpressions.join(", ");
    params.ExpressionAttributeValues = expressionAttributeValues;
  }
  
  if (removeExpressions.length > 0) {
    if (updateExpression) updateExpression += " ";
    updateExpression += "REMOVE " + removeExpressions.join(", ");
  }

  params.UpdateExpression = updateExpression;

  const logPrefix = `updating item :: documentId :: ${documentId} :: documentStatus :: ${documentStatus}`;
  try {
    await dynamoDBService.updateItem(params);
    logger.debug(`${logPrefix} :: document updated`);
  } catch (error) {
    logger.error(`${logPrefix} :: document update failed :: error :: ${error}`);
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

const generateCombinedPatientSummary = async (documents) => {
  const logPrefix = `generateCombinedPatientSummary`;
  try {
    // Combine all pages from all documents
    const allPages = [];
    documents.forEach((doc, docIndex) => {
      if (doc.pages && doc.pages.length > 0) {
        doc.pages.forEach((page, pageIndex) => {
          allPages.push(`Document ${docIndex + 1}, Page ${pageIndex + 1}: ${page}`);
        });
      }
    });

    const combinedText = allPages.join("\n\n");
    logger.info(`${logPrefix} :: processing ${documents.length} documents with ${allPages.length} total pages`);

    return await getMedicalInformation([combinedText]);
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message}`);
    throw error;
  }
};

const getMedicalInformation = async (pagesArray) => {
  const logPrefix = `getMedicalInformation`;
  try {
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

    const prompt = {
      inferenceConfig: {
        maxTokens: 5000,
      },
      messages: [
        {
          role: "user",
          content: [
            {
              text: `Extract the following discharge summary fields **in exact order**:  
    ${requiredFields.map((field) => `[${field}]`).join(", ")}  
    from the provided medical text.
    
    **Instructions:**  
    - The input contains **multiple medical documents for the same patient**.  
    - **COMBINE and CONSOLIDATE** information from all documents to create a comprehensive patient summary.  
    - Extract **all necessary fields** related to a discharge summary.  
    - Field names must be in **camelCase** format and enclosed in **brackets [ ]**.  
    - Every field must be returned as an object with a \`summarizedText\` key, e.g., \`"age": { "summarizedText": "45" }\`.  
    - If a field is missing, return an **empty string** ("") or \`0\` for numbers.  
    - **MERGE findings from multiple documents** - combine diagnoses, treatments, observations.  
    - **Chronologically order** events when multiple dates are present.  
    - **Consolidate medications** from all documents, removing duplicates.  
    - **Ensure extracted fields follow this exact order:**  
    ${requiredFields
                  .map((field, i) => `${i + 1}. [${field}]`)
                  .join("\n")}  
    
    **Additional Field Descriptions:**  
    - [diagnosis]: Extract in detail (2 to 3 lines).  
    - [systemicExamination]: Return a JSON array with exam name as "label" and value as "admission".  
    - [keyInvestigationSummary]: Extract in detail (4 to 5 lines).  
    - [hospitalCourse]: Extract in detail (6 to 7 lines).  
    - [hospitalizationTreatment]: List only unique drug names.  
    - [dischargeTreatment]: Return as a JSON array containing "drugName", "dosage", "frequency", "numberOfDays", and "remark".  
    
    **Expected JSON Response Format:**  
    \`\`\`json
    {
      "data": {
        "patientName": { "summarizedText": "John Doe" },
        "age": { "summarizedText": "45" },
        "gender": { "summarizedText": "Male" },
        "diagnosis": { "summarizedText": "Diabetes Mellitus\\nHypertension" },
        ...
      }
    }
    \`\`\`
    
    **Rules for JSON Formatting:**  
    - **Each field must contain a \`summarizedText\` key**—even if the value is empty.  
    - **No missing commas, brackets, or extra text** in the output.  
    - **Dates:** Use **YYYY-MM-DD HH:mm** format.  
    - **Numeric values:** Keep them as numbers inside \`summarizedText\`.  
    - **Names:** Use Pascal Case (e.g., "John Doe").  
    - **Maintain the exact order of fields as given above.**  
    - **Ensure JSON output is valid with no additional text.**  
    - **Frequency format:** Use string format like "0-1-1".  
    - **Avoid using short forms.**  
    - **Include possible remarks for drug usage.**
    
    **Medical Text Pages:**  
    ${formattedPages}`,
            },
          ],
        },
      ],
    };

    const response = await bedrockService.invokeBedrockModel(modelId, prompt);

    const cleanedResponse = response.trim().match(/{.*}/s);
    if (!cleanedResponse) {
      throw new Error("Invalid JSON response");
    }

    const parsedResponse = JSON.parse(cleanedResponse[0]);

    const orderedResponse = { data: {} };
    requiredFields.forEach((field) => {
      orderedResponse.data[field] = parsedResponse.data[field] || {
        pageSource: [],
        summarizedText: "",
      };
    });

    return orderedResponse;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message}`);
    throw error;
  }
};