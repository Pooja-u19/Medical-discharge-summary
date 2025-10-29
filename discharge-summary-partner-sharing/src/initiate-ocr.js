const { TextractClient, StartDocumentTextDetectionCommand } = require('@aws-sdk/client-textract');

const textractClient = new TextractClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        for (const record of event.Records) {
            const eventBridgeEvent = JSON.parse(record.body);
            console.log('EventBridge Event:', JSON.stringify(eventBridgeEvent, null, 2));
            
            const bucketName = eventBridgeEvent.detail.bucket.name;
            const objectKey = eventBridgeEvent.detail.object.key;
            
            console.log(`Processing file: ${objectKey} from bucket: ${bucketName}`);
            
            const params = {
                DocumentLocation: {
                    S3Object: {
                        Bucket: bucketName,
                        Name: objectKey
                    }
                },
                NotificationChannel: {
                    RoleArn: process.env.TEXTRACT_ROLE_ARN,
                    SNSTopicArn: process.env.TEXTRACT_SNS_TOPIC_ARN
                }
            };
            
            const command = new StartDocumentTextDetectionCommand(params);
            const result = await textractClient.send(command);
            
            console.log('Textract job started:', result.JobId);
        }
        
        return { statusCode: 200, body: 'OCR jobs initiated successfully' };
        
    } catch (error) {
        console.error('Error initiating OCR:', error);
        throw error;
    }
};