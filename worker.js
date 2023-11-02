const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const { compressFiles, getUniqueFileName } = require("./utilities");
dotenv.config();

AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN
});

const SQS = new AWS.SQS();
const S3 = new AWS.S3();
const QUEUE_URL = process.env.SQS_QUEUE_URL;

async function processMessages() {
  const messages = await SQS.receiveMessage({
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 5,
    WaitTimeSeconds: 20,
    VisibilityTimeout: 300 // 5 minutes
  }).promise();

  if (!messages.Messages) {
    console.log("No messages to process");
    return;
  }

  for (let message of messages.Messages) {
    console.log("Received SQS Message:", message.Body);  // Debugging line
    const body = JSON.parse(message.Body);
    try {
      const fileBuffers = await Promise.all(body.files.map(async filePath => {
        console.log("Trying to fetch file from S3 with path:", filePath);  // Debugging line
        const fileData = await S3.getObject({
          Bucket: process.env.AWS_BUCKET,
          Key: filePath
        }).promise();
        return { originalname: filePath.split('/').pop(), buffer: fileData.Body };
      }));

      const compressedBuffer = await compressFiles(fileBuffers);
      const dirName = `${body.username}_uploads`;
      const uniqueFileName = await getUniqueFileName(body.desiredFileName);

      const uploadParams = {
        Bucket: process.env.AWS_BUCKET,
        Key: `${dirName}/${uniqueFileName}`,
        Body: compressedBuffer
      };

      await S3.upload(uploadParams).promise();
      console.log(`Processed and uploaded files for user: ${body.username}`);

      await Promise.all(body.files.map(filePath => {
        return S3.deleteObject({
          Bucket: process.env.AWS_BUCKET,
          Key: filePath
        }).promise();
      }));
      console.log("Deleted temporary files");

      await SQS.deleteMessage({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle
      }).promise();
      console.log("Deleted message from SQS");

    } catch (error) {
      console.error("Error processing message:", error.message); // Modified error logging
    }
  }
}


// async function processMessages() {
//   const messages = await SQS.receiveMessage({
//     QueueUrl: QUEUE_URL,
//     MaxNumberOfMessages: 5,
//     WaitTimeSeconds: 20
//   }).promise();

//   if (!messages.Messages) {
//     console.log("No messages to process");
//     return;
//   }

//   for (let message of messages.Messages) {
//     const body = JSON.parse(message.Body);
//     try {
//       const fileBuffers = await Promise.all(body.files.map(async filePath => {
//         const fileData = await S3.getObject({
//           Bucket: process.env.AWS_BUCKET,
//           Key: filePath
//         }).promise();
//         return { originalname: filePath.split('/').pop(), buffer: fileData.Body };
//       }));

//       const compressedBuffer = await compressFiles(fileBuffers);
//       const dirName = `${body.username}_uploads`;
//       const uniqueFileName = await getUniqueFileName(body.desiredFileName);

//       const uploadParams = {
//         Bucket: process.env.AWS_BUCKET,
//         Key: `${dirName}/${uniqueFileName}`,
//         Body: compressedBuffer
//       };

//       await S3.upload(uploadParams).promise();
//       console.log(`Processed and uploaded files for user: ${body.username}`);

//       await Promise.all(body.files.map(filePath => {
//         return S3.deleteObject({
//           Bucket: process.env.AWS_BUCKET,
//           Key: filePath
//         }).promise();
//       }));
//       console.log("Deleted temporary files");

//       await SQS.deleteMessage({
//         QueueUrl: QUEUE_URL,
//         ReceiptHandle: message.ReceiptHandle
//       }).promise();
//       console.log("Deleted message from SQS");

//     } catch (error) {
//       console.error("Error processing message:", error);
//       // Not deleting the message here ensures it gets reprocessed.
//     }
//   }
// }

setInterval(processMessages, 30000); // Poll every 30 seconds.
