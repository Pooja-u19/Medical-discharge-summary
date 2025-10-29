const AWS = require('aws-sdk');

// Configure AWS SDK
const dynamodb = new AWS.DynamoDB.DocumentClient();
const logs = new AWS.CloudWatchLogs();

// Configuration - update these values
const DOCUMENTS_TABLE = process.env.DOCUMENTS_TABLE || 'document-summary-dev-documents';
const LAMBDA_FUNCTION_NAME = process.env.LAMBDA_FUNCTION_NAME || 'document-summary-dev-generate-summary';

async function diagnosePendingIssue() {
    console.log('🔍 DIAGNOSING PENDING STATUS ISSUE');
    console.log('=====================================\n');

    try {
        // 1. Check for documents stuck in PENDING status
        console.log('1. Checking for documents in PENDING status...');
        const pendingDocs = await dynamodb.scan({
            TableName: DOCUMENTS_TABLE,
            FilterExpression: 'documentStatus = :status',
            ExpressionAttributeValues: {
                ':status': 0 // PENDING status
            }
        }).promise();

        console.log(`   Found ${pendingDocs.Items.length} documents in PENDING status`);
        
        if (pendingDocs.Items.length > 0) {
            console.log('   PENDING Documents:');
            pendingDocs.Items.forEach((doc, index) => {
                console.log(`   ${index + 1}. DocumentID: ${doc.documentId}`);
                console.log(`      RequestID: ${doc.requestId}`);
                console.log(`      TextractJobId: ${doc.textractJobId || 'NOT SET'}`);
                console.log(`      Created: ${doc.createdAt}`);
                console.log(`      Updated: ${doc.updatedAt}`);
                console.log('');
            });
        }

        // 2. Check for documents with textractJobId but no results
        console.log('2. Checking for documents with textractJobId...');
        const docsWithJobId = await dynamodb.scan({
            TableName: DOCUMENTS_TABLE,
            FilterExpression: 'attribute_exists(textractJobId)',
            ProjectionExpression: 'documentId, textractJobId, documentStatus, createdAt'
        }).promise();

        console.log(`   Found ${docsWithJobId.Items.length} documents with textractJobId`);
        
        if (docsWithJobId.Items.length > 0) {
            console.log('   Documents with TextractJobId:');
            docsWithJobId.Items.forEach((doc, index) => {
                const status = doc.documentStatus === 0 ? 'PENDING' : 
                              doc.documentStatus === 1 ? 'LEGITIMATE' : 
                              doc.documentStatus === 2 ? 'SUSPICIOUS' : 'ERROR';
                console.log(`   ${index + 1}. ${doc.documentId} | JobId: ${doc.textractJobId} | Status: ${status}`);
            });
        }

        // 3. Check recent Lambda logs for errors
        console.log('\n3. Checking recent Lambda logs for errors...');
        const logGroups = await logs.describeLogGroups({
            logGroupNamePrefix: `/aws/lambda/${LAMBDA_FUNCTION_NAME}`
        }).promise();

        if (logGroups.logGroups.length > 0) {
            const logGroupName = logGroups.logGroups[0].logGroupName;
            console.log(`   Checking log group: ${logGroupName}`);

            const streams = await logs.describeLogStreams({
                logGroupName: logGroupName,
                orderBy: 'LastEventTime',
                descending: true,
                limit: 5
            }).promise();

            if (streams.logStreams.length > 0) {
                const recentStream = streams.logStreams[0];
                const events = await logs.getLogEvents({
                    logGroupName: logGroupName,
                    logStreamName: recentStream.logStreamName,
                    limit: 50
                }).promise();

                const errorEvents = events.events.filter(event => 
                    event.message.includes('ERROR') || 
                    event.message.includes('No documents found') ||
                    event.message.includes('CRITICAL')
                );

                if (errorEvents.length > 0) {
                    console.log(`   Found ${errorEvents.length} error events:`);
                    errorEvents.slice(0, 5).forEach((event, index) => {
                        console.log(`   ${index + 1}. ${new Date(event.timestamp).toISOString()}: ${event.message.substring(0, 200)}...`);
                    });
                } else {
                    console.log('   No recent error events found');
                }
            }
        }

        // 4. Check table indexes
        console.log('\n4. Checking DynamoDB table indexes...');
        const tableDescription = await dynamodb.send(new AWS.DynamoDB.DescribeTableCommand({
            TableName: DOCUMENTS_TABLE
        }));

        if (tableDescription.Table.GlobalSecondaryIndexes) {
            console.log('   Available GSIs:');
            tableDescription.Table.GlobalSecondaryIndexes.forEach(gsi => {
                console.log(`   - ${gsi.IndexName}: ${gsi.IndexStatus}`);
            });
        } else {
            console.log('   No GSIs found');
        }

        // 5. Recommendations
        console.log('\n📋 RECOMMENDATIONS:');
        console.log('==================');
        
        if (pendingDocs.Items.length > 0) {
            console.log('❌ ISSUE DETECTED: Documents stuck in PENDING status');
            console.log('   Solutions:');
            console.log('   1. Deploy the fixed Lambda function with TextractJobIdIndex GSI');
            console.log('   2. Run: fix-pending-status.bat');
            console.log('   3. Monitor logs after deployment');
        } else {
            console.log('✅ No documents currently stuck in PENDING status');
        }

        if (docsWithJobId.Items.some(doc => doc.documentStatus === 0)) {
            console.log('❌ ISSUE: Documents with textractJobId still in PENDING status');
            console.log('   This indicates the GenerateSummary Lambda is not processing them');
        }

    } catch (error) {
        console.error('❌ Error during diagnosis:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the diagnosis
diagnosePendingIssue().then(() => {
    console.log('\n🏁 Diagnosis completed');
}).catch(error => {
    console.error('❌ Diagnosis failed:', error);
});