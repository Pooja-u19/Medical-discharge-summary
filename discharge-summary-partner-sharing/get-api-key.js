const { CloudFormationClient, DescribeStacksCommand } = require("@aws-sdk/client-cloudformation");
const { APIGatewayClient, GetApiKeyCommand } = require("@aws-sdk/client-api-gateway");

async function getApiKey() {
    try {
        const cfClient = new CloudFormationClient({ region: "us-east-1" });
        const apiGatewayClient = new APIGatewayClient({ region: "us-east-1" });
        
        // Get stack outputs
        const stackName = "discharge-summary-dev"; // Adjust if different
        const describeCommand = new DescribeStacksCommand({ StackName: stackName });
        const stackResponse = await cfClient.send(describeCommand);
        
        const stack = stackResponse.Stacks[0];
        const apiKeyOutput = stack.Outputs.find(output => output.OutputKey === "ApiKey");
        
        if (apiKeyOutput) {
            const apiKeyId = apiKeyOutput.OutputValue;
            console.log("API Key ID:", apiKeyId);
            
            // Get the actual API key value
            const getKeyCommand = new GetApiKeyCommand({ 
                apiKey: apiKeyId,
                includeValue: true 
            });
            const keyResponse = await apiGatewayClient.send(getKeyCommand);
            
            console.log("API Key Value:", keyResponse.value);
            console.log("\nUpdate your .env file with:");
            console.log(`REACT_APP_API_KEY=${keyResponse.value}`);
        } else {
            console.log("API Key not found in stack outputs");
        }
        
    } catch (error) {
        console.error("Error retrieving API key:", error.message);
        console.log("\nAlternatively, you can get the API key from AWS Console:");
        console.log("1. Go to API Gateway console");
        console.log("2. Click on 'API Keys' in the left sidebar");
        console.log("3. Find 'DischargeSummaryApiKey'");
        console.log("4. Click 'Show' to reveal the key value");
    }
}

getApiKey();