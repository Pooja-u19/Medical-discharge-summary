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
  "anthropic.claude-3-sonnet-20240229-v1:0"
);

export const handler = async (event) => {
  logger.info("generate summary lambda triggered");
  logger.debug(`event received :: ${JSON.stringify(event)}`);

  for (const record of event.Records) {
    let textractJobId, textractJobStatus;
    
    try {
      const messageBody = JSON.parse(record.body);
      const message = JSON.parse(messageBody.Message);
      textractJobId = message.JobId;
      textractJobStatus = message.Status;
      
      logger.info(`Processing Textract job: ${textractJobId} with status: ${textractJobStatus}`);
    } catch (parseError) {
      logger.error(`Failed to parse SQS message: ${parseError.message}`);
      continue;
    }
    // Get document info from DynamoDB using textract job ID
    const documents = await dynamoDBService.scan({
      TableName: documentsTable,
      FilterExpression: "textractJobId = :jobId",
      ExpressionAttributeValues: {
        ":jobId": textractJobId,
      },
      Limit: 1
    });
    
    if (!documents.Items || documents.Items.length === 0) {
      logger.warn(`No document found for jobId: ${textractJobId}`);
      continue;
    }
    
    const document = documents.Items[0];
    const requestId = document.requestId;
    const documentId = document.documentId;
    const logPrefix = `processing record :: requestId :: ${requestId} :: documentId :: ${documentId} :: jobId :: ${textractJobId} :: textractJobStatus :: ${textractJobStatus}`;

    try {
      if (textractJobStatus === textractStatus.SUCCEEDED) {
        const pages = await textractService.getDocumentTextDetectionResults(
          textractJobId
        );

        const medicalInformation = await getMedicalInformation(pages);
        if (
          !medicalInformation?.data ||
          Object.values(medicalInformation.data).every((value) => value.summarizedText === "")
        ) {
          logger.warn(
            `${logPrefix} :: no relevant medical information found in extracted text.`
          );
          await updateDocumentItem(
            documentId,
            documentStatus.ERROR,
            null,
            null,
            "no relevant medical information found in document"
          );
          return;
        }

        logger.debug(
          `${logPrefix} :: medicalInformation :: ${JSON.stringify(
            medicalInformation
          )}`
        );

        const documents = await dynamoDBService.query({
          TableName: documentsTable,
          IndexName: "RequestIdIndex",
          KeyConditionExpression: "requestId = :requestId",
          ExpressionAttributeValues: {
            ":requestId": requestId,
          },
        });

        if (documents.Count === 0) {
          logger.warn(`${logPrefix} :: documents not found`);
          return;
        }

        for (const document of documents.Items) {
          if (
            document &&
            document.documentS3Path &&
            medicalInformation &&
            document.documentStatus === documentStatus.PENDING
          ) {
            await updateDocumentItem(
              documentId,
              documentStatus.LEGITIMATE,
              pages,
              medicalInformation.data
            );
            
            await updateRequestStatus(requestId, "COMPLETED");
            
            await snsService.publishToSNS(
              `Discharge Summary Generated for Request ${requestId}`,
              "Discharge Summary"
            );
          }
        }
      } else {
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
          `Text extraction failed for Request ${requestId}`,
          "Discharge Summary"
        );
      }
    } catch (error) {
      logger.error(`${logPrefix} :: error :: ${error.message}`);
      await updateDocumentItem(documentId, documentStatus.ERROR, null, null, error.message);
      await updateRequestStatus(requestId, "FAILED");
      await snsService.publishToSNS(
        `Processing failed for Request ${requestId}, ${error.message}`,
        "Discharge Summary"
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

  const logPrefix = `updating item :: documentId :: ${documentId} :: documentStatus :: ${documentStatus}`;
  try {
    await dynamoDBService.updateItem(params);
    logger.debug(`${logPrefix} :: document updated`);
  } catch (error) {
    logger.error(`${logPrefix} :: document update failed :: error :: ${error}`);
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
    - The input is an **array of pages** (medical documents).  
    - Extract **all necessary fields** related to a discharge summary.  
    - Field names must be in **camelCase** format and enclosed in **brackets [ ]**.  
    - Every field must be returned as an object with a \`summarizedText\` key, e.g., \`"age": { "summarizedText": "45" }\`.  
    - If a field is missing, return an **empty string** ("") or \`0\` for numbers.  
    - **Do NOT include field names or labels in extracted values.**  
    - If a field has multiple values, separate them using **\\n** (newline).  
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
    logger.debug(`Request ${requestId} status updated to ${status}`);
  } catch (error) {
    logger.error(`Failed to update request ${requestId} status: ${error.message}`);
    throw error;
  }
};