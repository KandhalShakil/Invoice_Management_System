import os
import logging
import boto3
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from botocore.exceptions import NoCredentialsError

logger = logging.getLogger(__name__)

class FileStorageService:
    @staticmethod
    def upload_file(file_obj, directory, filename):
        """
        Uploads a file to AWS S3 (if keys are configured) or local storage.
        Returns the absolute URL of the uploaded file.
        """
        # Clean path formatting
        clean_path = f"{directory}/{filename}"
        
        # Check AWS Configuration
        if all([settings.AWS_ACCESS_KEY_ID, settings.AWS_SECRET_ACCESS_KEY, settings.AWS_STORAGE_BUCKET_NAME]):
            try:
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_S3_REGION_NAME
                )
                
                # Upload the file object
                s3_client.upload_fileobj(
                    file_obj,
                    settings.AWS_STORAGE_BUCKET_NAME,
                    clean_path,
                    ExtraArgs={'ACL': 'public-read', 'ContentType': getattr(file_obj, 'content_type', 'application/octet-stream')}
                )
                
                # Return the S3 path
                url = f"https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com/{clean_path}"
                logger.info(f"File uploaded to S3: {url}")
                return url
                
            except NoCredentialsError:
                logger.warning("AWS Credentials invalid. Falling back to local filesystem storage.")
            except Exception as e:
                logger.error(f"S3 Upload failed: {str(e)}. Falling back to local filesystem storage.")

        # Fallback: Local FileSystemStorage
        fs = FileSystemStorage()
        saved_name = fs.save(clean_path, file_obj)
        url = fs.url(saved_name)
        
        # If absolute URL is needed locally, construct it
        domain = os.getenv('BACKEND_DOMAIN', 'http://localhost:8000')
        full_url = f"{domain}{url}"
        logger.info(f"File uploaded to local filesystem: {full_url}")
        return full_url
