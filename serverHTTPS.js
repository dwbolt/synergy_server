/*

small web server that serves static files and a
API to webserver

*/

// built in nodejs modules
const https    = require('https');  // access to https protocal
const fs       = require('fs');     // access to local server file system

// create server class and load configuration file
app       = new (require('./server.js'))("../configHTTPS");  // class where the work gets done

// helper functions to get access to app object
function requestIn(  request, response) {app.requestIn(           request, response);}
function responseEnd(request, response) {app.sessions.responseEnd(request, response);}

// server request and reponse loop
async function startServer() {
  await app.createLogFiles();
  app.logError("function startServer - test error log")
  app.sessions = new (require('./sessions.js'            ));   // keep track of sessions, requests and responses

  // start server loop
  https.createServer(
    {
    // https certificates for encription
    key:  fs.readFileSync('../certificates/sfcknox.org/private.key.pem')
   ,cert: fs.readFileSync('../certificates/sfcknox.org/domain.cert.pem')
   ,ca:   fs.readFileSync('../certificates/sfcknox.org/intermediate.cert.pem')
    },requestIn
  ).listen(app.config.port);

  console.log(`https:// Server using port: ${app.config.port}`);
}

startServer();
