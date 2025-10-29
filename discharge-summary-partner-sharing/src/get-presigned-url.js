const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    try {
        const body = JSON.parse(event.body || '{}');
        const { fileName, contentType = 'application/pdf' } = body;
        
        if (!fileName) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ error: 'fileName is required' })
            };
        }
        
        const key = `uploads/${Date.now()}-${fileName}`;
        
        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            ContentType: contentType
        });
        
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadUrl: presignedUrl,
                key: key
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};