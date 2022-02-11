/*

small web server that serves static files and a
API to webserver

*/

// built in nodejs modules
const https    = require('https');  // access to https protocal
const fs       = require('fs');     // access to local server file system

app = new (require('./server.js'))("./configDev");  // class where the work gets done

// helper functions to get access to app object
function requestIn(  request, response) {app.requestIn(           request, response);}
function responseEnd(request, response) {app.sessions.responseEnd(request, response);}

// server request and reponse loop
https.createServer(
  {
  // https certificates for encription
  key:  fs.readFileSync('certificates/prod_sfcknox_org_key')
 ,cert: fs.readFileSync('certificates/prod.sfcknox.org.crt')
 ,ca:   fs.readFileSync('certificates/prod.sfcknox.org.ca-bundle')
  },requestIn
).listen(app.config.port);

console.log(`https:// Server using port: ${app.config.port}`);
