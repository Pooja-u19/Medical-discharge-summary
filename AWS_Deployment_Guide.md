# Discharge Summary Application - AWS Deployment Guide

## Table of Contents
1. [Application Overview](#application-overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Environment-Specific Configurations](#environment-specific-configurations)
6. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
7. [Cleanup](#cleanup)
8. [Important Notes](#important-notes)

---

## Application Overview

The Discharge Summary Application is a **serverless medical document processing application** that automatically generates discharge summaries from uploaded medical documents using AWS services and AI.

### Core Functionality

**Document Upload & Processing:**
- Users can upload PDF medical documents (up to 5MB) through a React web interface
- The system generates presigned URLs for secure document uploads to S3
- Documents are automatically processed through an OCR (Optical Character Recognition) pipeline

**AI-Powered Text Extraction & Analysis:**
- Uses **AWS Textract** to extract text from uploaded PDF documents
- Employs **Amazon Bedrock** (Claude AI model) to analyze the extracted text and generate structured discharge summaries
- Extracts specific medical fields like patient name, diagnosis, treatment plans, medications, etc.

**Structured Data Output:**
- Converts unstructured medical documents into structured discharge summaries with standardized fields:
  - Patient demographics (name, age, gender)
  - Medical details (diagnosis, symptoms, examination results)
  - Treatment information (medications, dosages, instructions)
  - Hospital course and discharge planning

### Technical Architecture

**Backend (AWS Serverless):**
- **Lambda Functions** for document processing, OCR initiation, and summary generation
- **API Gateway** for REST API endpoints
- **DynamoDB** for storing document metadata and processing status
- **S3** for document storage with encryption
- **SQS/SNS** for asynchronous processing and notifications
- **CloudFront** for content delivery

**Frontend (React):**
- Modern React application with TypeScript
- Document upload interface
- Request tracking and status monitoring
- Document viewer for processed results

### Key Features

1. **Secure Document Handling** - KMS encryption, presigned URLs, access controls
2. **Asynchronous Processing** - Event-driven architecture for handling large documents
3. **Fraud Detection** - Document hash comparison to identify duplicates
4. **Real-time Status Updates** - Track processing progress through different stages
5. **Error Handling** - Comprehensive error tracking and notification system
6. **Scalable Architecture** - Serverless design that scales automatically

---

## Prerequisites

Before deploying the application, ensure you have the required tools installed:

### 1. Install AWS SAM CLI

**macOS (using Homebrew):**
```bash
brew install aws-sam-cli
```

**Linux:**
```bash
# Download the installer
wget https://github.com/aws/aws-sam-cli/releases/latest/download/aws-sam-cli-linux-x86_64.zip
unzip aws-sam-cli-linux-x86_64.zip -d sam-installation
sudo ./sam-installation/install
```

**Windows:**
Download and run the MSI installer from the AWS SAM CLI releases page.

### 2. Install Node.js 18+ and npm

**macOS:**
```bash
brew install node@18
```

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Install Docker

Download and install Docker Desktop from: https://docs.docker.com/desktop/

### 4. Configure AWS CLI

```bash
# Install AWS CLI if not already installed
pip install awscli

# Configure with your AWS credentials
aws configure
```

You'll need to provide:
- AWS Access Key ID
- AWS Secret Access Key
- Default region name
- Default output format (json)

---

## Deployment Steps

### Step 1: Build the Application

```bash
# Navigate to the project root directory
cd discharge-summary

# Install Node.js dependencies
npm install

# Build the SAM application
sam build
```

### Step 2: Deploy with Guided Setup (First Time)

For the first deployment, use the guided setup:

```bash
sam deploy --guided
```

This will prompt you for configuration parameters. Here are the recommended values:

| Parameter | Description | Recommended Value |
|-----------|-------------|-------------------|
| **Stack Name** | CloudFormation stack name | `discharge-summary-dev` |
| **AWS Region** | AWS region for deployment | `us-east-1` or your preferred region |
| **ProjectName** | Project identifier | `discharge-summary` |
| **Environment** | Environment name | `dev` (or `prod` for production) |
| **EnableS3Lifecycle** | Enable S3 lifecycle policy | `Disabled` (dev), `Enabled` (prod) |
| **S3LifecycleDuration** | Days before S3 transition | `30` |
| **EnableDynamoDBPITR** | Enable DynamoDB Point-in-Time Recovery | `false` (dev), `true` (prod) |
| **EnableDynamoDBDeleteProtection** | Prevent accidental table deletion | `false` (dev), `true` (prod) |
| **SNSSubscriptionEmailsAlerts** | Email for notifications | Your email address |
| **SQSMessageRetentionPeriod** | SQS message retention (seconds) | `1209600` (14 days) |
| **SQSVisibilityTimeout** | SQS visibility timeout (seconds) | `300` |
| **MaxReceiveCount** | Max retries before DLQ | `5` |
| **RateLimit** | API rate limit (requests/second) | `100` |
| **BurstLimit** | API burst limit | `200` |
| **QuotaLimit** | Monthly quota limit | `1000` |
| **Confirm changes before deploy** | Review changes | `Y` |
| **Allow SAM CLI IAM role creation** | Create IAM roles | `Y` |
| **Save arguments to samconfig.toml** | Save configuration | `Y` |

### Step 3: Create Required AWS Service Role

The application requires a Textract service role. Create it manually:

```bash
# Create the AmazonTextractServiceRole
aws iam create-role --role-name AmazonTextractServiceRole --assume-role-policy-document '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "textract.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}'

# Attach required policies
aws iam attach-role-policy \
  --role-name AmazonTextractServiceRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonTextractServiceRole

aws iam attach-role-policy \
  --role-name AmazonTextractServiceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess
```

### Step 4: Enable Bedrock Model Access

Enable the required Bedrock model in your AWS account:

**Option 1: AWS Console**
1. Navigate to the AWS Bedrock console
2. Go to "Model access" in the left sidebar
3. Enable access for "Amazon Nova Lite" (or the model specified in template.yaml)
4. Submit the request and wait for approval

**Option 2: AWS CLI**
```bash
# Enable model access (replace with your region)
aws bedrock put-model-invocation-logging-configuration --region us-east-1
```

### Step 5: Deploy Frontend (Optional)

If you want to deploy the React frontend to the hosting S3 bucket:

```bash
# Navigate to the client directory
cd client

# Install frontend dependencies
npm install

# Build the React application
npm run build

# Get the hosting bucket name from CloudFormation outputs
HOSTING_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name your-stack-name \
  --query 'Stacks[0].Outputs[?OutputKey==`HostingS3Bucket`].OutputValue' \
  --output text)

# Upload the built files to S3
aws s3 sync build/ s3://$HOSTING_BUCKET --delete
```

### Step 6: Subsequent Deployments

After the initial setup, you can deploy updates with:

```bash
sam deploy
```

---

## Post-Deployment Configuration

### 1. Get Deployment Outputs

Retrieve important information from your deployment:

```bash
# Get all stack outputs
aws cloudformation describe-stacks \
  --stack-name your-stack-name \
  --query 'Stacks[0].Outputs'

# Get specific outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name your-stack-name \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayURL`].OutputValue' \
  --output text)

API_KEY=$(aws cloudformation describe-stacks \
  --stack-name your-stack-name \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKey`].OutputValue' \
  --output text)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name your-stack-name \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text)

echo "API Gateway URL: $API_URL"
echo "API Key: $API_KEY"
echo "CloudFront URL: $CLOUDFRONT_URL"
```

### 2. Test the API

Test your deployed API:

```bash
# Test the document upload endpoint
curl -X POST $API_URL/dev/api/v1/document/upload \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "documentType": "other_documents",
        "contentType": "application/pdf",
        "size": 1024000
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "documents submission requested successfully",
  "data": {
    "presignedUrls": [...],
    "requestId": "uuid-here"
  }
}
```

### 3. Configure Frontend Environment

If deploying the frontend, update the environment configuration:

```bash
# Create or update client/.env
cat > client/.env << EOF
REACT_APP_API_BASE_URL=$API_URL/dev
REACT_APP_API_KEY=$API_KEY
EOF
```

---

## Environment-Specific Configurations

### Development Environment

```bash
sam deploy --parameter-overrides \
  Environment=dev \
  EnableDynamoDBPITR=false \
  EnableDynamoDBDeleteProtection=false \
  EnableS3Lifecycle=Disabled \
  RateLimit=10 \
  BurstLimit=20 \
  QuotaLimit=100 \
  SNSSubscriptionEmailsAlerts=dev@yourcompany.com
```

### Staging Environment

```bash
sam deploy --parameter-overrides \
  Environment=staging \
  EnableDynamoDBPITR=true \
  EnableDynamoDBDeleteProtection=false \
  EnableS3Lifecycle=Enabled \
  S3LifecycleDuration=30 \
  RateLimit=50 \
  BurstLimit=100 \
  QuotaLimit=500 \
  SNSSubscriptionEmailsAlerts=staging@yourcompany.com
```

### Production Environment

```bash
sam deploy --parameter-overrides \
  Environment=prod \
  EnableDynamoDBPITR=true \
  EnableDynamoDBDeleteProtection=true \
  EnableS3Lifecycle=Enabled \
  S3LifecycleDuration=90 \
  RateLimit=100 \
  BurstLimit=200 \
  QuotaLimit=1000 \
  SummaryGenerationLambdaTimeout=600 \
  SummaryGenerationLambdaMemory=2048 \
  SNSSubscriptionEmailsAlerts=admin@yourcompany.com
```

---

## Monitoring and Troubleshooting

### View Lambda Function Logs

```bash
# View logs for specific functions
sam logs -n CreateRequestFunction --stack-name your-stack-name --tail
sam logs -n InitiateOcrFunction --stack-name your-stack-name --tail
sam logs -n GenerateSummaryFunction --stack-name your-stack-name --tail

# View logs with specific time range
sam logs -n CreateRequestFunction --stack-name your-stack-name \
  --start-time '2024-01-01T00:00:00' --end-time '2024-01-02T00:00:00'
```

### Local Testing

```bash
# Start API locally
sam local start-api

# Test specific function locally
sam local invoke CreateRequestFunction --event events/test-event.json

# Generate test events
sam local generate-event apigateway aws-proxy > test-event.json
```

### CloudWatch Monitoring

Set up CloudWatch alarms for production:

```bash
# Create alarm for Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name "discharge-summary-lambda-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=your-function-name \
  --evaluation-periods 2
```

### Common Issues and Solutions

**Issue 1: Textract Service Role Not Found**
```bash
# Solution: Create the role as described in Step 3
aws iam get-role --role-name AmazonTextractServiceRole
```

**Issue 2: Bedrock Model Access Denied**
```bash
# Solution: Enable model access in Bedrock console
# Navigate to AWS Bedrock > Model access > Enable required models
```

**Issue 3: S3 Bucket Access Denied**
```bash
# Solution: Check bucket policy and IAM permissions
aws s3api get-bucket-policy --bucket your-bucket-name
```

---

## Cleanup

To remove all resources and avoid ongoing charges:

### Complete Stack Deletion

```bash
# Delete the CloudFormation stack
sam delete --stack-name your-stack-name

# Confirm deletion when prompted
```

### Manual Cleanup (if needed)

Some resources might need manual cleanup:

```bash
# Empty S3 buckets before deletion (if stack deletion fails)
aws s3 rm s3://your-documents-bucket --recursive
aws s3 rm s3://your-hosting-bucket --recursive

# Delete the Textract service role
aws iam detach-role-policy \
  --role-name AmazonTextractServiceRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonTextractServiceRole
aws iam detach-role-policy \
  --role-name AmazonTextractServiceRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSNSFullAccess
aws iam delete-role --role-name AmazonTextractServiceRole
```

---

## Important Notes

### Cost Considerations

1. **Bedrock Costs**: AI model inference charges based on input/output tokens
2. **Textract Costs**: Per-page charges for document analysis
3. **Lambda Costs**: Based on execution time and memory allocation
4. **Storage Costs**: S3 storage and data transfer charges
5. **DynamoDB Costs**: Based on read/write capacity and storage

### Security Best Practices

1. **Encryption**: All data is encrypted at rest using KMS
2. **Access Control**: Proper IAM roles and policies are implemented
3. **API Security**: API Gateway with API keys and rate limiting
4. **Network Security**: VPC endpoints can be added for enhanced security
5. **Monitoring**: CloudTrail and CloudWatch for audit and monitoring

### Performance Optimization

1. **Lambda Memory**: Adjust memory allocation based on document size
2. **Timeout Settings**: Configure appropriate timeouts for processing
3. **Batch Processing**: SQS batch sizes can be tuned for throughput
4. **Caching**: CloudFront caching for static content

### Backup and Recovery

1. **DynamoDB**: Enable Point-in-Time Recovery for production
2. **S3**: Enable versioning and cross-region replication if needed
3. **Lambda**: Source code should be version controlled
4. **Configuration**: Keep samconfig.toml in version control

### Compliance Considerations

1. **HIPAA**: Additional configurations may be needed for healthcare data
2. **Data Retention**: Configure S3 lifecycle policies appropriately
3. **Audit Logging**: Enable CloudTrail for compliance requirements
4. **Data Location**: Ensure deployment region meets compliance needs

---

## Support and Resources

### AWS Documentation
- [AWS SAM Developer Guide](https://docs.aws.amazon.com/serverless-application-model/)
- [Amazon Textract Documentation](https://docs.aws.amazon.com/textract/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)

### Troubleshooting Resources
- [AWS SAM CLI Troubleshooting](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-troubleshooting.html)
- [Lambda Function Troubleshooting](https://docs.aws.amazon.com/lambda/latest/dg/troubleshooting.html)

### Community Support
- [AWS SAM GitHub Repository](https://github.com/aws/aws-sam-cli)
- [AWS Developer Forums](https://forums.aws.amazon.com/)
- [Stack Overflow - AWS SAM](https://stackoverflow.com/questions/tagged/aws-sam)

---

*This deployment guide was generated for the Discharge Summary Application. For the most up-to-date information, please refer to the project's README.md file and AWS documentation.*