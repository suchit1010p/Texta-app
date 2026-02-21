import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../db/aws.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const generatePutPresignedUrl = async (fileName) => {
    try {
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName
        });
        return await getSignedUrl(s3, command, { expiresIn: 3600 });
    } catch (error) {
       console.error("Error generating presigned URL:", error);
        throw new Error("Could not generate presigned URL");
    }
}

const deleteFromS3 = async (fileUrl) => {
    try {
        if (!fileUrl) return;
        if (!String(fileUrl).startsWith("http")) {
            const command = new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: decodeURIComponent(String(fileUrl)),
            });
            await s3.send(command);
            return true;
        }

        let key = "";

        const urlObj = new URL(fileUrl);
        const pathParts = urlObj.pathname.split('/');

        if (urlObj.hostname.startsWith(process.env.AWS_BUCKET_NAME)) {
            key = urlObj.pathname.substring(1); // remove leading /
        } else {
            key = urlObj.pathname.split('/').slice(2).join('/');
        }

        if (!key) {
            key = pathParts[pathParts.length - 1];
        }

        key = decodeURIComponent(key);

        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
        });

        await s3.send(command);
        return true;
    } catch (error) {
        console.error("Error deleting from S3:", error);
        return false;
    }
};

export {
    generatePutPresignedUrl,
    deleteFromS3
}