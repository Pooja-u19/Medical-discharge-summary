import AWS from "aws-sdk";
import logger from "../utils/logger.mjs";

const dynamo = new AWS.DynamoDB.DocumentClient();

export const dynamoDBService = {
  putItem: async (params) => {
    try {
      logger.info(
        `dynamoDBService :: putItem :: params :: ${JSON.stringify(params)}`
      );
      return await dynamo.put(params).promise();
    } catch (error) {
      logger.error(`dynamoDBService :: putItem :: error :: ${error.message}`);
      throw error;
    }
  },
  query: async (params) => {
    try {
      logger.info(
        `dynamoDBService :: query :: params :: ${JSON.stringify(params)}`
      );
      return await dynamo.query(params).promise();
    } catch (error) {
      logger.error(`dynamoDBService :: query :: error :: ${error.message}`);
      throw error;
    }
  },
  updateItem: async (params) => {
    try {
      logger.info(
        `dynamoDBService :: updateItem :: params :: ${JSON.stringify(params)}`
      );
      return await dynamo.update(params).promise();
    } catch (error) {
      logger.error(`dynamoDBService :: update :: error :: ${error.message}`);
      throw error;
    }
  },
  batchWrite: async (params) => {
    const logPrefix = `batchWrite :: params :: ${JSON.stringify(params)}`;

    if (!params.TableName) throw new Error("Table name is required");
    if (!params.Items || params.Items.length === 0)
      throw new Error("No items to write to DynamoDB");

    const writeRequests = params.Items.map((item) => ({
      PutRequest: { Item: item },
    }));

    const requestParams = {
      RequestItems: { [params.TableName]: writeRequests },
    };

    try {
      logger.info(logPrefix);
      const result = await dynamo.batchWrite(requestParams).promise();

      if (result.UnprocessedItems?.[params.TableName]?.length > 0) {
        logger.warn(
          `${logPrefix} :: unprocessed items, retrying :: ${JSON.stringify(
            result.UnprocessedItems
          )}`
        );
        return batchWrite({
          ...params,
          Items: result.UnprocessedItems[params.TableName],
        });
      }

      return result;
    } catch (error) {
      logger.error(
        `${logPrefix} :: error :: ${error.message} :: ${error.stack || error}`
      );
      throw error;
    }
  },
  getItem: async (params) => {
    try {
      logger.info(
        `dynamoDBService :: getItem :: params :: ${JSON.stringify(params)}`
      );
      return await dynamo.get(params).promise();
    } catch (error) {
      logger.error(`dynamoDBService :: getItem :: error :: ${error.message}`);
      throw error;
    }
  },
  scan: async (params) => {
    try {
      logger.info(
        `dynamoDBService :: scan :: params :: ${JSON.stringify(params)}`
      );
      return await dynamo.scan(params).promise();
    } catch (error) {
      logger.error(`dynamoDBService :: scan :: error :: ${error.message}`);
      throw error;
    }
  },
};
