const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { v4: uuidv4 } = require('uuid');  // for generating unique file names

async function compressFiles(files) {
    const tempFilePath = path.join(__dirname, `temp.7z`);
    const tempFiles = [];

    try {
        // Save the files with unique names concurrently
        const writePromises = files.map(async file => {
            const uniqueName = `${uuidv4()}_${file.originalname}`;
            await fs.writeFile(uniqueName, file.buffer);
            tempFiles.push(uniqueName);
        });
        
        await Promise.all(writePromises);

        // Create a list of files to compress
        const fileList = tempFiles.map(fileName => `"${fileName}"`).join(' ');

        // Run 7zip command with maximum compression
        await exec(`7z a -mx=9 ${tempFilePath} ${fileList}`);

        const compressedBuffer = await fs.readFile(tempFilePath);
        return compressedBuffer;

    } catch (err) {
        throw err;

    } finally {
        // Always cleanup, regardless of success or failure
        await Promise.allSettled([
            fs.unlink(tempFilePath),
            ...tempFiles.map(tempFile => fs.unlink(tempFile))
        ]);
    }
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
