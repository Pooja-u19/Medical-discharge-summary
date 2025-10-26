import AWS from "aws-sdk";
import logger from "../utils/logger.mjs";

const textract = new AWS.Textract();

export const startDocumentTextDetection = async (params) => {
  const logPrefix = `textractService :: startDocumentTextDetection :: params :: ${JSON.stringify(
    params
  )}`;

  try {
    logger.info(logPrefix);
    const result = await textract.startDocumentTextDetection(params).promise();
    logger.debug(`${logPrefix} :: result :: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message} :: ${error}`);
    throw error;
  }
};

export const getDocumentTextDetectionResults = async (
  jobId,
  maxResults = 1000
) => {
  const logPrefix = `textractService :: getDocumentTextDetectionResults :: jobId :: ${jobId} :: maxResults :: ${maxResults}`;

  let results = [];
  let nextToken = null;
  let hasMoreResults = true;

  try {
    while (hasMoreResults) {
      const params = {
        JobId: jobId,
        MaxResults: maxResults,
        NextToken: nextToken,
      };
      logger.info(`${logPrefix} :: params :: ${JSON.stringify(params)}`);

      const response = await textract
        .getDocumentTextDetection(params)
        .promise();
      logger.debug(`${logPrefix} :: response :: ${JSON.stringify(response)}`);

      results = results.concat(response.Blocks);
      nextToken = response.NextToken;

      if (!nextToken) {
        hasMoreResults = false;
      }
    }
    const pages = await getPageTextArray(results);
    logger.debug(`${logPrefix} :: pages :: ${pages}`);
    return pages;
  } catch (error) {
    logger.error(`${logPrefix} :: error :: ${error.message} :: ${error}`);
    throw error;
  }
};

async function getPageTextArray(blocks) {
  const pageArray = [];

  for (const block of blocks) {
    if (block.BlockType === "WORD") {
      const pageIndex = block.Page - 1;
      if (!pageArray[pageIndex]) {
        pageArray[pageIndex] = [];
      }

      pageArray[pageIndex].push(block.Text);
    }
  }
  return pageArray.map((page) => (page ? page.join(" ") : ""));
}
