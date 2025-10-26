import AWS from "aws-sdk";
import logger from "../utils/logger.mjs";
import { envHelper } from "../helpers/index.mjs";

const sns = new AWS.SNS();
const topicArn = envHelper.getStringEnv("SNS_TOPIC_ARN");

export const publishToSNS = async (message, subject = null) => {
  const logPrefix = `snsService :: publishToSNS :: message :: ${message} :: subject :: ${
    subject || "No Subject"
  }`;

  try {
    logger.info(`${logPrefix} :: preparing to publish message`);

    const params = {
      Message: JSON.stringify(message),
      TopicArn: topicArn,
      ...(subject && { Subject: subject }),
    };

    const response = await sns.publish(params).promise();
    logger.debug(
      `${logPrefix} :: message published successfully :: ${JSON.stringify(
        response
      )}`
    );
    return response;
  } catch (error) {
    logger.error(`${logPrefix} :: failed to publish message`, { error });
    throw error;
  }
};
