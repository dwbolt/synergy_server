/*

small web server that serves static files

*/

// built in nodejs modules
http    = require('http');  // access to https protocal

app = new (require('./server.js'))("./configHTTP");  // class where the work gets done

// helper function to get access to app object
function requestIn(request, response) {
  app.requestIn(request, response)
}

// server request and reponse loop
http.createServer(requestIn).listen(app.config.port);

console.log(`https:// Server using port: ${app.config.port}`);
