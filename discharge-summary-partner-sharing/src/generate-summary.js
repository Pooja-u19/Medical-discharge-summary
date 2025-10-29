const { TextractClient, GetDocumentTextDetectionCommand } = require('@aws-sdk/client-textract');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const textractClient = new TextractClient({ region: process.env.AWS_REGION });
const snsClient = new SNSClient({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        for (const record of event.Records) {
            const snsMessage = JSON.parse(record.body);
            const textractMessage = JSON.parse(snsMessage.Message);
            
            console.log('Textract Message:', JSON.stringify(textractMessage, null, 2));
            
            const jobId = textractMessage.JobId;
            const status = textractMessage.Status;
            
            if (status !== 'SUCCEEDED') {
                console.log(`Job ${jobId} status: ${status}. Skipping processing.`);
                continue;
            }
            
            // Get Textract results
            const getResultsParams = {
                JobId: jobId
            };
            
            let extractedText = '';
            let nextToken = null;
            
            do {
                if (nextToken) {
                    getResultsParams.NextToken = nextToken;
                }
                
                const command = new GetDocumentTextDetectionCommand(getResultsParams);
                const result = await textractClient.send(command);
                
                // Extract text from blocks
                if (result.Blocks) {
                    for (const block of result.Blocks) {
                        if (block.BlockType === 'LINE') {
                            extractedText += block.Text + '\n';
                        }
                    }
                }
                
                nextToken = result.NextToken;
            } while (nextToken);
            
            console.log('Extracted text length:', extractedText.length);
            
            // Generate summary (simplified - you can integrate with Bedrock here)
            const summary = generateSimpleSummary(extractedText);
            
            // Send final notification
            const publishParams = {
                TopicArn: process.env.FINAL_SNS_TOPIC_ARN,
                Subject: 'Document Processing Complete',
                Message: JSON.stringify({
                    jobId: jobId,
                    status: 'COMPLETED',
                    summary: summary,
                    textLength: extractedText.length,
                    timestamp: new Date().toISOString()
                }, null, 2)
            };
            
            const publishCommand = new PublishCommand(publishParams);
            await snsClient.send(publishCommand);
            
            console.log('Final notification sent for job:', jobId);
        }
        
        return { statusCode: 200, body: 'Processing completed successfully' };
        
    } catch (error) {
        console.error('Error processing Textract results:', error);
        throw error;
    }
};

function generateSimpleSummary(text) {
    if (!text || text.length === 0) {
        return 'No text extracted from document.';
    }
    
    // Simple summary logic - take first 500 characters
    const summary = text.substring(0, 500);
    return summary + (text.length > 500 ? '...' : '');
}