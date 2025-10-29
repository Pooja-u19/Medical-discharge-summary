const { DynamoDBClient, ScanCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({ region: "us-east-1" });

async function fixMissingPatientIds() {
  try {
    // Scan for documents without patientId
    const scanCommand = new ScanCommand({
      TableName: "document-summary-dev-documents",
      FilterExpression: "attribute_not_exists(patientId)"
    });
    
    const result = await client.send(scanCommand);
    console.log(`Found ${result.Items.length} documents without patientId`);
    
    // Update each document with a new patientId
    for (const item of result.Items) {
      const documentId = item.documentId.S;
      const patientId = uuidv4();
      
      const updateCommand = new UpdateItemCommand({
        TableName: "document-summary-dev-documents",
        Key: {
          documentId: { S: documentId }
        },
        UpdateExpression: "SET patientId = :pid",
        ExpressionAttributeValues: {
          ":pid": { S: patientId }
        }
      });
      
      await client.send(updateCommand);
      console.log(`Updated document ${documentId} with patientId ${patientId}`);
    }
    
    console.log("All documents updated successfully!");
  } catch (error) {
    console.error("Error:", error);
  }
}

fixMissingPatientIds();