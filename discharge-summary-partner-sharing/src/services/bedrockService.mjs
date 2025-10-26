import AWS from "aws-sdk";
import logger from "../utils/logger.mjs";

const bedrockRuntime = new AWS.BedrockRuntime();

export const invokeBedrockModel = async (modelId, prompt) => {
  const logPrefix = `bedrockService :: invokeBedrockModel :: modelId :: ${modelId}`;

  try {
    logger.info(`${logPrefix} :: preparing request to bedrock`);

    const requestPayload = {
      body: JSON.stringify(prompt),
      modelId,
      accept: "application/json",
      contentType: "application/json",
    };

    const response = await bedrockRuntime.invokeModel(requestPayload).promise();
    logger.debug(`${logPrefix} :: response :: ${JSON.stringify(response)}`);

    const jsonString = Buffer.from(response.body).toString("utf-8");
    const jsonResponse = JSON.parse(jsonString);
    logger.debug(
      `${logPrefix} :: jsonResponse :: ${JSON.stringify(jsonResponse)}`
    );

    const extractedContent = jsonResponse?.output?.message?.content?.[0]?.text;
    const cleanJsonString = extractedContent.replace(/```json\n|\n```/g, "");
    logger.debug(
      `${logPrefix} :: response received successfully :: ${cleanJsonString}`
    );
    return cleanJsonString;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message}`);
    throw error;
  }
};
