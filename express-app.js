
const MjpegProxy = require('./mjpeg-proxy').MjpegProxy;

const express = require('express');
const errorHandler = require('errorhandler');
const morgan = require('morgan');

const HTTP_PORT = 8091; // change port

//insert cams
const cam1 = 'http://guard:guard@192.168.10.41/axis-cgi/mjpg/video.cgi?&streamprofile=MjpegHD';
const cam21 = 'http://guard:guard@192.168.10.41/axis-cgi/mjpg/video.cgi?&streamprofile=MjpegFullHD';


var app = express();
app.use(errorHandler({ dumpExceptions: true, showStack: true }));
app.use(morgan('tiny'));
app.set("view options", { layout: false });
app.use(express.static(__dirname + '/public'));

//insert index
app.get('/1/low.jpg', new MjpegProxy(cam1).proxyRequest);
app.get('/1/high.jpg', new MjpegProxy(cam2).proxyRequest);

app.listen(HTTP_PORT);

console.log("Listening on port " + HTTP_PORT);

