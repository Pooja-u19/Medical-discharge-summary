const fs = require("fs");
const sharp = require("sharp");
const {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} = require("@aws-sdk/client-sagemaker-runtime");

const REGION = "ap-south-1";
const ENDPOINT_NAME = "huggingface-pytorch-tgi-inference-2025-05-06-08-38-28-097";

const client = new SageMakerRuntimeClient({ region: REGION });

async function predictRadiologyDescription(imagePath, instruction) {
  try {
    const imageBuffer = await sharp(imagePath)
      .resize({ width: 512, height: 512, fit: "contain" })
      .jpeg()
      .toBuffer();
    const base64Image = imageBuffer.toString("base64");
    console.log(base64Image)
    const payload = {
      image: base64Image,
      instruction: instruction,
    };

    const command = new InvokeEndpointCommand({
      EndpointName: ENDPOINT_NAME,
      Body: JSON.stringify(payload),
      ContentType: "application/json",
    });

    const response = await client.send(command);

    console.log("Model Output:\n", result);
    return result;
  } catch (error) {
    console.error("Error invoking endpoint:", error);
    return `Error: ${error.message}`;
  }
}

const imagePath = "/Users/nchilkur/Downloads/demo.jpeg";
const instruction =
  "You are an expert radiographer. Describe accurately what you see in this image.";

predictRadiologyDescription(imagePath, instruction);
