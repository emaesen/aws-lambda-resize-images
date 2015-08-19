# AWS Lambda function for image resizing

This function will generate three (or more, or less) resized images for responsive websites: large, medium and small.

The functionality is based on the thumbnail generator described in http://docs.aws.amazon.com/lambda/latest/dg/walkthrough-s3-events-adminuser.html (this AWS documentation describes in detail how to setup the proper IAM user and roles).

## Setup

Install npm packes async and gm (GraphicsMagick) in the root folder:
```
npm install async
npm install gm
```

## Configure
Modify the code (`resize_images.js`) to change the configuration. If left unmodified, three sized images will be created.

```
// configuration as code - add, modify, remove array elements as desired
var imgVariants = [
  {
    "SIZE": "Large",
    "POSTFIX": "-l",
    "MAX_WIDTH": 1200,
    "MAX_HEIGHT": 1000,
    "SIZING_QUALITY": 70,
    "INTERLACE": "Line"
  },
  {
    "SIZE": "Medium",
    "POSTFIX": "-m",
    "MAX_WIDTH": 800,
    "MAX_HEIGHT": 800,
    "SIZING_QUALITY": 60,
    "INTERLACE": "Line"
  },
  {
    "SIZE": "Small",
    "POSTFIX": "-s",
    "MAX_WIDTH": 300,
    "MAX_HEIGHT": 400,
    "SIZING_QUALITY": 50,
    "INTERLACE": "Line"
  }
];
// The name of the destination S3 bucket is derived by adding this postfix to the name of the source S3 bucket:
var DST_BUCKET_POSTFIX = "-resized";
```

The source and destination AWS S3 buckets must exist.


## Interface with AWS

The following assumes/requires the existence within your AWS account of:
1.	an "adminuser" user with administrative permission
2.	a "awsLambdaExecute" role with execute permission

In case any code changes are made, (re)zip the resize_images.js file and node_modules folder into "resize_images.zip".


### Test whether lambda can be reached with the adminuser
`aws lambda list-functions --profile adminuse`


### Create a zip file
Bundle both `resize_images.js` and the `node_modules` folder in a zip file

### Upload the zip file
(run in the folder where the zip file is located):

```
aws lambda create-function \
--region us-west-2 \
--function-name resize_images \
--zip-file fileb://resize_images.zip \
--role arn:aws:iam::172166755826:role/awsLambdaExecute \
--handler resize_images.handler \
--runtime nodejs \
--profile adminuser \
--timeout 10 \
--memory-size 1024
```

### Execute a test file input.json

```
aws lambda invoke \
--invocation-type Event \
--function-name resize_images \
--region us-west-2 \
--payload file://input.json \
--profile adminuser \
outputfile.log
```

### View execution logs
(assuming you are in region 'us-west-2')

https://us-west-2.console.aws.amazon.com/cloudwatch/home?region=us-west-2#logs:


### Upload an updated zip file
(run in the folder where the zip file is located):

```
aws lambda update-function-code \
--region us-west-2 \
--function-name resize_images \
--zip-file fileb://resize_images.zip \
--profile adminuser
```

### Execution through AWS console
Trigger the Lambda function in the source S3 bucket by adding a 'Put' Notification (send to your Lamda function) in the Events section of the bucket's Properties.

Once this is in place, uploading an image file to the source S3 bucket will automatically generate the resized images in the destination S3 bucket.
