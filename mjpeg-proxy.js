// Copyright (C) 2013, Georges-Etienne Legendre <legege@legege.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var url = require('url');
var http = require('http');
const { exec } = require("child_process");

function extractBoundary(contentType) {
  contentType = contentType.replace(/\s+/g, '');

  var startIndex = contentType.indexOf('boundary=');
  var endIndex = contentType.indexOf(';', startIndex);
  if (endIndex == -1) { //boundary is the last option
    // some servers, like mjpeg-streamer puts a '\r' character at the end of each line.
    if ((endIndex = contentType.indexOf('\r', startIndex)) == -1) {
      endIndex = contentType.length;
    }
  }
  return contentType.substring(startIndex + 9, endIndex).replace(/"/gi,'').replace(/^\-\-/gi, '');
}

var RUNNING = 0;

var MjpegProxy = exports.MjpegProxy = function(mjpegUrl) {
  var self = this;
  RUNNING += 1;
  console.log(`RUNNING : ${RUNNING}`);
  if (!mjpegUrl) throw new Error('Please provide a source MJPEG URL');

  self.mjpegOptions = new URL(mjpegUrl);

  self.audienceResponses = [];
  self.newAudienceResponses = [];

  self.boundary = null;
  self.globalMjpegResponse = null;
  self.mjpegRequest = null;
  self.data_timestamp = null;

  self.proxyRequest = function(req, res) {
    if (res.socket==null) {
      return;
    }
    now = Math.floor(Date.now() / 1000);
    if (self.data_timestamp !== null){
       diff = now -self.data_timestamp;
       if (diff >= 15) {
          console.log(`DATA DIFF, ${mjpegUrl} : ${diff}`);
	  self.mjpegRequest = null;
          self.globalMjpegResponse.destroy();
          for (var i = self.audienceResponses.length; i--;) {
            let _res = self.audienceResponses[i];
            _res.end();
          }

          self.boundary = null;
          self.audienceResponses = [];
     	  self.newAudienceResponses = [];
	  console.log(`DESTROYING EVERYTHING`);
	  self.data_timestamp = Math.floor(Date.now() / 1000);
	  return res.end();
	}
    }

    // There is already another client consuming the MJPEG response
    if (self.mjpegRequest !== null) {
      self._newClient(req, res);
    } else {
      // Send source MJPEG request
      self.mjpegRequest = http.request(self.mjpegOptions, function(mjpegResponse) {
        // console.log(`statusCode: ${mjpegResponse.statusCode}`)
        self.globalMjpegResponse = mjpegResponse;
        self.boundary = extractBoundary(mjpegResponse.headers['content-type']);

        self._newClient(req, res);


        mjpegResponse.on('data', function(chunk) {
          // Fix CRLF issue on iOS 6+: boundary should be preceded by CRLF.
          var buff = Buffer.from(chunk);
	  self.data_timestamp = Math.floor(Date.now() / 1000);
          for (var i = self.audienceResponses.length; i--;) {
            var res = self.audienceResponses[i];

            // First time we push data... lets start at a boundary
	
            if (self.newAudienceResponses.length > 0 && self.newAudienceResponses.indexOf(res) >= 0) {
              var p = buff.indexOf('--' + self.boundary);
              if (p >= 0) {
                res.write(chunk.slice(p));
                self.newAudienceResponses.splice(self.newAudienceResponses.indexOf(res), 1); // remove from new
              }
            } else {
              res.write(chunk);
            }
          }
        });
        mjpegResponse.on('end', function () {
          // console.log("...end");
          for (var i = self.audienceResponses.length; i--;) {
            var res = self.audienceResponses[i];
            res.end();
          }
        });
        mjpegResponse.on('close', function () {
          // console.log("...close");
        });
      });

      self.mjpegRequest.on('error', function(e) {
        console.error('problem with request: ', e);
      });
      self.mjpegRequest.end();
    }
  }

  self._newClient = function(req, res) {
    if (req.query.reload == 1){
          self.mjpegRequest = null;
          self.globalMjpegResponse.destroy();
          for (var i = self.audienceResponses.length; i--;) {
            let _res = self.audienceResponses[i];
            _res.end();
          }

          self.boundary = null;
          self.audienceResponses = [];
          self.newAudienceResponses = [];
          console.log(`DESTROYING EVERYTHING`);
        exec("sudo systemctl restart mjpeg-proxy.service", (error, stdout, stderr) => {});
        self.mjpegRequest.destroy();
    } else {
      res.Buffer = false;
      res.BufferOutput = false;
      res.writeHead(200, {
        'Expires': 'Mon, 01 Jul 1980 00:00:00 GMT',
        'Cache-Control': 'no-cache, no-store, must-revalidate, private',
        'Age': 0,
        'Pragma': 'no-cache',
        'Content-Type': 'multipart/x-mixed-replace;boundary=' + self.boundary
      });
      self.audienceResponses.push(res);
      self.newAudienceResponses.push(res);
    }

    res.socket.on('close', function () {
      // console.log('exiting client!');

      self.audienceResponses.splice(self.audienceResponses.indexOf(res), 1);
      if (self.newAudienceResponses.indexOf(res) >= 0) {
        self.newAudienceResponses.splice(self.newAudienceResponses.indexOf(res), 1); // remove from new
      }
      if (self.audienceResponses.length == 0) {
	console.log('No audience left, destroy request');
        self.data_timestamp = null;
	self.mjpegRequest = null;
        if (self.globalMjpegResponse) {
          self.globalMjpegResponse.destroy();
        }
      }
    });
  }
}
