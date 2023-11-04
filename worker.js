require('dotenv').config();
const AWS = require('aws-sdk');
const { compressFiles, getUniqueFileName } = require("./utilities");

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN // Optional, only if necessary for your setup
});

const SQS = new AWS.SQS();
const S3 = new AWS.S3();
const QUEUE_URL = process.env.SQS_QUEUE_URL;

async function fetchFileFromS3(filePath) {
  console.log("Fetching file from S3 with path:", filePath);
  const fileData = await S3.getObject({
    Bucket: process.env.AWS_BUCKET,
    Key: filePath
  }).promise();
  return { originalname: filePath.split('/').pop(), buffer: fileData.Body };
}

async function processMessage(message) {
  console.log("Received SQS Message:", message.Body);
  const body = JSON.parse(message.Body);

  // Fetch files from S3 concurrently
  const fileBuffers = await Promise.all(body.files.map(fetchFileFromS3));

  // Compress files
  const compressedBuffer = await compressFiles(fileBuffers);
  const dirName = `${body.username}_uploads`;
  const uniqueFileName = getUniqueFileName(body.desiredFileName);

  // Upload compressed file to S3
  const uploadParams = {
    Bucket: process.env.AWS_BUCKET,
    Key: `${dirName}/${uniqueFileName}`,
    Body: compressedBuffer
  };
  await S3.upload(uploadParams).promise();
  console.log(`Processed and uploaded files for user: ${body.username}`);

  // Delete the temporary files from S3
  await Promise.all(body.files.map(filePath =>
    S3.deleteObject({
      Bucket: process.env.AWS_BUCKET,
      Key: filePath
    }).promise()
  ));
  console.log("Deleted temporary files from S3");

  // Delete message from SQS
  await SQS.deleteMessage({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: message.ReceiptHandle
  }).promise();
  console.log("Deleted message from SQS");
}

async function pollSQSQueue() {
  while (true) {
    try {
      const data = await SQS.receiveMessage({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 3,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300
      }).promise();

      const { Messages } = data;
      if (Messages && Messages.length > 0) {
        // Process messages concurrently
        await Promise.all(Messages.map(processMessage));
      } else {
        console.log("No messages to process. Waiting for new messages...");
      }
    } catch (error) {
      console.error("Error during SQS polling and message processing:", error);
      // Implement exponential backoff or delay as needed before the next poll
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds delay
    }
  }
}

pollSQSQueue();
