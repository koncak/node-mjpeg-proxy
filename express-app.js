
const MjpegProxy = require('./mjpeg-proxy').MjpegProxy;

const express = require('express');
const errorHandler = require('errorhandler');
const morgan = require('morgan');

const HTTP_PORT = 8091; // change port

//insert cams
const cam1 = 'http://guard:guard@172.16.100.45/axis-cgi/mjpg/video.cgi?&streamprofile=MjpegHD&camera=4';
const cam2 = 'http://guard:guard@172.16.100.45/axis-cgi/mjpg/video.cgi?&streamprofile=MjpegFullHD&camera=4';
const cam3 = 'http://guard:guard@172.16.100.50/axis-cgi/mjpg/video.cgi?&streamprofile=MjpegHD';
const cam4 = 'http://guard:guard@172.16.100.50/axis-cgi/mjpg/video.cgi?&streamprofile=MjpegFullHD';


var app = express();
app.use(errorHandler({ dumpExceptions: true, showStack: true }));
app.use(morgan('tiny'));
app.set("view options", { layout: false });
app.use(express.static(__dirname + '/public'));

//insert index
app.get('/45/low.jpg', new MjpegProxy(cam1).proxyRequest);
app.get('/45/high.jpg', new MjpegProxy(cam2).proxyRequest);
app.get('/4/low.jpg', new MjpegProxy(cam3).proxyRequest);
app.get('/4/high.jpg', new MjpegProxy(cam4).proxyRequest);

app.listen(HTTP_PORT);

console.log("Listening on port " + HTTP_PORT);

