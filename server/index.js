const express = require('express');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');
const cors = require('cors');
const archiver = require('archiver');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(cors());

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// function to download a file from S3 and store it in server
const downloadFile = async (key, outputPath) => {
  const params = {
    Bucket: bucketName,
    Key: key,
  };

  const fileContent = await s3.getObject(params).promise();

  await fs.writeFile(outputPath, fileContent.Body);

  return outputPath;
};

// function to create a zip archive 
// sourceFolderPath - unzipped folder path
// outputZipPath - path to create a zip folder
function createZipArchive(sourceFolderPath, outputZipPath) {
  console.log(sourceFolderPath, "source folder path");

  // f there is no source folder, return
  if (!fss.existsSync(sourceFolderPath)) {
    console.error('Source folder does not exist.');
    return;
  }

  const output = fss.createWriteStream(outputZipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes');
    console.log('Zip file has been created successfully.');
  });

  output.on('end', function () {
    console.log('Data has been drained');
  });

  archive.on('error', function (err) {
    throw err;
  });

  archive.on('finish', function () {
    // Check if the zip archive contains any files
    if (archive.pointer() > 0) {
      // Delete the source folder after creating the zip
      deleteSourceFolder(sourceFolderPath);
    } else {
      console.error('Zip file is empty. Source folder will not be deleted.');
    }
  });

  archive.pipe(output);
  archive.directory(sourceFolderPath, false);
  archive.finalize();
}

// function to delete the source folder
function deleteSourceFolder(sourceFolderPath) {
  fss.rmdirSync(sourceFolderPath, { recursive: true });
  console.log('Source folder deleted successfully.');
}

// function to list all objects in a folder recursively
const listAllObjects = async (prefix = '') => {
  const objects = await s3.listObjectsV2({ Bucket: bucketName, Prefix: prefix }).promise();

  const promises = objects.Contents.map(async (object) => {
    if (object.Key.endsWith('/')) {
      if (object.Key !== prefix) {
        const folderPath = path.join(__dirname, 's3folder', object.Key);
        // create local folder in server if its not the file to maintain the fodler heirarchy
        await fs.mkdir(folderPath, { recursive: true });
        return listAllObjects(object.Key);
      }
    } else {
      // output path where the file will be downloaded in server
      // object.key is the absolute path where the object is stored eg information/information1/info.txt 
      const outputPath = path.join(__dirname, 's3folder', object.Key);

      // check if the file already exists
      if (fss.existsSync(outputPath)) {
        console.log(`File ${object.Key} already exists. Skipping download.`);
      } else {
        await downloadFile(object.Key, outputPath);
      }
    }
  });

  await Promise.all(promises.flat());
};

// API endpoint to initiate file download
app.get('/download', async (req, res) => {
  try {
    console.log("DOWNLOAD STARTED");
    await listAllObjects();
    const sourceFolderPath = path.join(__dirname, 's3folder');
    createZipArchive(sourceFolderPath, path.join(__dirname, 's3folder.zip'));

    res.header('Content-Type', 'application/zip');
    res.sendFile(sourceFolderPath);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});