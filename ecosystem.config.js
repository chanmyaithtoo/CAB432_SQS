module.exports = {
  apps: [
    {
      name: "File-Compression-Worker",
      script: "./path-to-your-worker-file.js", // Ensure this path points to your worker script
      instances: 1, // You can adjust this for clustering
      autorestart: true,
      watch: true, // Set to true if you want to restart the worker on file changes
      max_memory_restart: "1G", // Restart the worker if it exceeds this memory. Adjust if necessary.
      env: {
        NODE_ENV: "development",
        SQS_QUEUE_URL:
          "https://sqs.ap-southeast-2.amazonaws.com/901444280953/N11178931_Queue",
        AWS_REGION: "ap-southeast-2",
        AWS_BUCKET: "n11178931-drive",
      },
      env_production: {
        NODE_ENV: "production",
        SQS_QUEUE_URL:
          "https://sqs.ap-southeast-2.amazonaws.com/901444280953/N11178931_Queue",
        AWS_REGION: "ap-southeast-2",
        AWS_BUCKET: "n11178931-drive",
      },
    },
  ],
};
