# Create the function

 aws lambda create-function \
--region us-east-1 \
--function-name resize_badges \
--zip-file fileb://lambda-archive.zip \
--role arn:aws:iam::413704506032:role/image-processing \
--handler resize_images.handler \
--runtime nodejs4.3 \
--timeout 10 \
--memory-size 1024
#

# Remove the function
 aws lambda delete-function \
--region us-east-1 \
--function-name resize_images \

# How do we get the triggers from the s3 bucket and from hitting an API (for bulk resize)
