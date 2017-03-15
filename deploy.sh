zip -r lambda-archive.zip node_modules resize_images.js >/dev/null
aws lambda update-function-code --region ap-southeast-2 --function-name resize_images --zip-file fileb://lambda-archive.zip
aws lambda update-function-code --region us-east-1      --function-name resize_images --zip-file fileb://lambda-archive.zip
rm lambda-archive.zip

