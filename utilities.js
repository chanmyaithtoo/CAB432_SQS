const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function compressFiles(files) {
    const tempDir = path.join(__dirname, 'CAB432_SQS');
    const archiveName = `archive_${uuidv4()}.7z`;
    const tempFilePath = path.join(tempDir, archiveName);
    const tempFiles = [];

    try {
        await fs.mkdir(tempDir, { recursive: true });

        const writePromises = files.map(async file => {
            const uniqueName = path.join(tempDir, `${uuidv4()}_${file.originalname}`);
            await fs.writeFile(uniqueName, file.buffer);
            tempFiles.push(uniqueName);
        });

        await Promise.all(writePromises);

        const fileList = tempFiles.map(escapeFileName).join(' ');
        const zipCommand = `7z a -mx=1 ${escapeFileName(tempFilePath)} ${fileList}`;
        
        console.log("Executing compression command:", zipCommand);
        await exec(zipCommand);

        const compressedBuffer = await fs.readFile(tempFilePath);
        return compressedBuffer;

    } catch (error) {
        console.error(`Error during file compression:`, error);
        throw error;
    } finally {
        const cleanupPromises = tempFiles.map(file => fs.unlink(file).catch(err => console.error(`Failed to delete temporary file:`, file, err)));
        await Promise.all(cleanupPromises);

        try {
            await fs.unlink(tempFilePath);
            console.log(`Deleted temporary archive: ${tempFilePath}`);
        } catch (error) {
            console.error(`Failed to delete temporary archive:`, tempFilePath, error);
        }
    }
}

function getUniqueFileName(desiredFileName) {
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    return `${desiredFileName.replace(/\.[^/.]+$/, '')}_${timestamp}.${desiredFileName.split('.').pop()}`;
}

function escapeFileName(filename) {
    return `"${filename.replace(/(["\\$`])/g, '\\$1')}"`;
}

module.exports = {
    compressFiles,
    getUniqueFileName
};
