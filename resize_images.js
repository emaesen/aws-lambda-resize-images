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
    "SIZE": "Medium",
    "PREFIX": "medium_",
    "MAX_WIDTH": 300,
    "MAX_HEIGHT": 300,
    "SIZING_QUALITY": 95,
    "INTERLACE": "Line"
  },
  {
    "SIZE": "Tiny",
    "PREFIX": "tiny_",
    "MAX_WIDTH": 50,
    "MAX_HEIGHT": 50,
    "SIZING_QUALITY": 90,
    "INTERLACE": "Line"
  },
  {
    "SIZE": "Large",
    "PREFIX": "large_",
    "MAX_WIDTH": 1080,
    "MAX_HEIGHT": 2060,
    "SIZING_QUALITY": 90,
    "INTERLACE": "Line"
  },
  {
    "SIZE": "Newsfeed",
    "PREFIX": "newsfeed_",
    "MAX_WIDTH": 470,
    "MAX_HEIGHT": 835,
    "SIZING_QUALITY": 90,
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
  /*var srcFile = srcKey.match(/(.+)\.([^.]+)/);
  var srcName = srcFile[1];
  var scrExt = srcFile[2];*/
  // set the destination bucket
  var dstBucket = srcBucket
  var dstPathElements = srcKey.split('/')
  var dstName = dstPathElements.pop()
  dstPathElements[1] = 'resized'
  var dstPath = dstPathElements.join('/') + '/'
/*
  if (!scrExt) {
    console.error('unable to derive file type extension from file key ' + srcKey);
    return;
  }

  if (scrExt != "jpg" && scrExt != "png") {
    console.log('skipping non-supported file type ' + srcKey + ' (must be jpg or png)');
    return;
  }
*/
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
        .toBuffer('jpg', function (err, buffer) {
          if (err) {
            callback(err);
          } else {
            uploadImage(data.ContentType, buffer, options, callback);
          }
        });
    });
  }

  function uploadImage(contentType, data, options, callback) {
    var dstKey = dstPath + options.PREFIX + dstName

    console.log("Uploading '" + dstKey + "' to " + dstBucket);

    // Upload the transformed image to the destination S3 bucket.
    s3.putObject({
        Bucket: dstBucket,
        Key: dstKey,
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
