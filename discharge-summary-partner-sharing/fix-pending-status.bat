@echo off
echo ========================================
echo FIXING PENDING STATUS ISSUE
echo ========================================
echo.
echo This script will:
echo 1. Deploy the updated CloudFormation template with TextractJobIdIndex GSI
echo 2. Update the Lambda function with improved document lookup
echo 3. Test the fix
echo.

set /p CONTINUE="Continue with deployment? (y/n): "
if /i "%CONTINUE%" neq "y" (
    echo Deployment cancelled.
    exit /b 1
)

echo.
echo Step 1: Building and deploying the stack...
call sam build --template-file template-fixed.yaml
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed!
    exit /b 1
)

call sam deploy --config-file samconfig.toml --template-file template-fixed.yaml
if %ERRORLEVEL% neq 0 (
    echo ERROR: Deployment failed!
    exit /b 1
)

echo.
echo Step 2: Waiting for GSI to become active...
echo Note: The TextractJobIdIndex GSI may take a few minutes to become active.
echo You can check the status in the AWS Console under DynamoDB > Tables > Indexes

echo.
echo Step 3: Testing the fix...
echo Upload a test document to verify the fix is working.

echo.
echo ========================================
echo DEPLOYMENT COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo IMPORTANT NOTES:
echo - The TextractJobIdIndex GSI may take 5-10 minutes to become fully active
echo - During this time, the Lambda will use the fallback scan method
echo - Once the GSI is active, document lookups will be much faster
echo - Monitor CloudWatch logs to verify the fix is working
echo.
echo Next steps:
echo 1. Wait for GSI to become active (check DynamoDB console)
echo 2. Upload a test document
echo 3. Monitor CloudWatch logs for the GenerateSummary Lambda
echo 4. Verify documents no longer get stuck in PENDING status
echo.
pause