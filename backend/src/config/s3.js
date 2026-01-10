const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET || 'your-bucket-name';

/**
 * S3에 파일 업로드
 * @param {Buffer} fileBuffer - 파일 버퍼
 * @param {string} key - S3 키 (경로/파일명)
 * @param {string} contentType - MIME 타입
 * @returns {Promise<string>} - S3 URL
 */
const uploadToS3 = async (fileBuffer, key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType
  });

  await s3Client.send(command);

  return `https://${BUCKET_NAME}.s3.ap-northeast-2.amazonaws.com/${key}`;
};

/**
 * S3에서 파일 삭제
 * @param {string} key - S3 키
 */
const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key
  });

  await s3Client.send(command);
};

module.exports = {
  s3Client,
  BUCKET_NAME,
  uploadToS3,
  deleteFromS3
};
