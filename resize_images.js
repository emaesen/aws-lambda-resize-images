// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm').subClass({
  imageMagick: true
}); // use ImageMagick
var util = require('util');

// configuration as code - add, modify, remove array elements as desired
var imgVariants = [
  {
    "SIZE": "Small",
    "POSTFIX": "small",
    "MAX_WIDTH": 300,
    "MAX_HEIGHT": 300,
    "SIZING_QUALITY": 70,
    "INTERLACE": "Line"
  },
  {
    "SIZE": "Tiny",
    "POSTFIX": "tiny",
    "MAX_WIDTH": 50,
    "MAX_HEIGHT": 50,
    "SIZING_QUALITY": 60,
    "INTERLACE": "Line"
  }
];

// get reference to S3 client
var s3 = new AWS.S3();

exports.handler = function (event, context) {
  // Read options from the event.
  console.log("Reading options from event:\n", util.inspect(event, {
    depth: 5
  }));
  var srcBucket = event.Records[0].s3.bucket.name;
  // Object key may have spaces or unicode non-ASCII characters.
  var srcKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  // derive the file name and extension
  var srcFile = srcKey.match(/(.+)\.([^.]+)/);
  var srcName = srcFile[1];
  var scrExt = srcFile[2];
  // set the destination bucket
  var dstBucket = srcBucket
  var dstBasePath = 'uploads/resized/'
  var dstName = srcName.replace('uploads/originals', '')

  if (!scrExt) {
    console.error('unable to derive file type extension from file key ' + srcKey);
    return;
  }

  if (scrExt != "jpg" && scrExt != "png") {
    console.log('skipping non-supported file type ' + srcKey + ' (must be jpg or png)');
    return;
  }

  function processImage(data, options, callback) {
    gm(data.Body).size(function (err, size) {

      var scalingFactor = Math.min(
        options.MAX_WIDTH / size.width,
        options.MAX_HEIGHT / size.height
      );
      var width = scalingFactor * size.width;
      var height = scalingFactor * size.height;

      this.resize(width, height)
        .quality(options.SIZING_QUALITY || 75)
        .interlace(options.INTERLACE || 'None')
        .toBuffer(scrExt, function (err, buffer) {
          if (err) {
            callback(err);
          } else {
            uploadImage(data.ContentType, buffer, options, callback);
          }
        });
    });
  }

  function uploadImage(contentType, data, options, callback) {
    var dstFullPath = dstBasePath + options.POSTFIX + dstName + '.' + scrExt

    console.log("Uploading '" + dstFullPath + "' to " + dstBucket);

    // Upload the transformed image to the destination S3 bucket.
    s3.putObject({
        Bucket: dstBucket,
        Key: dstFullPath,
        Body: data,
        ContentType: contentType
      },
      callback);
  }


  // Download the image from S3 and process for each requested image variant.
  async.waterfall(
    [
      function download(next) {
          // Download the image from S3 into a buffer.
          console.log("Downloading '" + srcKey + "' from " + srcBucket);

          s3.getObject({
              Bucket: srcBucket,
              Key: srcKey
            },
            next);
      },
      function processImages(data, next) {
          async.each(imgVariants, function (variant, next) {
            console.log("resizing " + variant.SIZE);
            processImage(data, variant, next);
          }, next);
      }

    ],
    function (err) {
      if (err) {
        console.error(
          'Unable to resize ' + srcBucket + '/' + srcKey +
          ' and upload to ' + dstBucket +
          ' due to an error: ' + err
        );
      } else {
        console.log(
          'Successfully resized ' + srcBucket + '/' + srcKey +
          ' and uploaded to ' + dstBucket
        );
      }

      context.done();
    }
  );
};
