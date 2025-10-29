@echo off
echo ========================================
echo  DEPLOYING FIXED DOCUMENT PROCESSING PIPELINE
echo ========================================

echo.
echo 1. Backing up original files...
copy template.yaml template-original-backup.yaml
copy src\handlers\initiate-ocr.mjs src\handlers\initiate-ocr-original-backup.mjs
copy src\handlers\generate-summary.mjs src\handlers\generate-summary-original-backup.mjs

echo.
echo 2. Replacing with fixed versions...
copy template-fixed.yaml template.yaml
copy src\handlers\initiate-ocr-fixed.mjs src\handlers\initiate-ocr.mjs
copy src\handlers\generate-summary-fixed.mjs src\handlers\generate-summary.mjs

echo.
echo 3. Building SAM application...
sam build

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: SAM build failed!
    goto :restore
)

echo.
echo 4. Deploying to AWS...
sam deploy

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: SAM deploy failed!
    goto :restore
)

echo.
echo ========================================
echo  DEPLOYMENT SUCCESSFUL!
echo ========================================
echo.
echo Your document processing pipeline is now deployed with:
echo - Fixed circular dependencies
echo - Proper EventBridge → SQS → Lambda flow
echo - Enhanced logging and error handling
echo - Dead Letter Queues for both Lambdas
echo.
echo Flow: S3 upload → EventBridge → SQS → InitiateOCR → Textract → SNS → SQS → GenerateSummary → SNS email
echo.
goto :end

:restore
echo.
echo Restoring original files due to deployment failure...
copy template-original-backup.yaml template.yaml
copy src\handlers\initiate-ocr-original-backup.mjs src\handlers\initiate-ocr.mjs
copy src\handlers\generate-summary-original-backup.mjs src\handlers\generate-summary.mjs
echo Original files restored.

:end
pause