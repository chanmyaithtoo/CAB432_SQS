const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

function compressFiles(files) {
    return new Promise(async (resolve, reject) => {
        const tempFilePath = path.join(__dirname, `temp.7z`);
        
        // Save the files with their original names
        try {
            for (let file of files) {
                await fs.writeFile(file.originalname, file.buffer);
            }

            // Create a list of files to compress using their original names
            const fileList = files.map(file => `"${file.originalname}"`).join(' ');

            // Run 7zip command with maximum compression
            exec(`7z a -mx=9 ${tempFilePath} ${fileList}`, async (error) => {
                if (error) {
                    reject(error);
                    return;
                }

                const compressedBuffer = await fs.readFile(tempFilePath);
                resolve(compressedBuffer);

                // Clean up temporary files
                await fs.unlink(tempFilePath);
                for (let file of files) {
                    await fs.unlink(file.originalname);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function getUniqueFileName(desiredFileName) {
    let fileNameParts = desiredFileName.split('.');
    let baseName = fileNameParts[0];
    let extension = fileNameParts[1];

    let currentFileName = `${baseName}(${format(Date.now())}).${extension}`;
    return currentFileName;
}

function format(timestamp) {
    const date = new Date(timestamp);
    
    // Extract day, month, year, hours, minutes, and seconds
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');  // Months are 0-based
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    // Format as dd/mm/yyyy hh:mm:ss
    return `${day},${month},${year} ${hours}:${minutes}:${seconds}`;
}

module.exports = {
    compressFiles,
    getUniqueFileName,
}
