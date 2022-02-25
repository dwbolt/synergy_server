// web server: static files and and API to webserver

// create server class and load configuration file
app = new (require('./server.js'))("./configHTTP");  // class where the work gets done

// server request and reponse loop
async function startServer() {
  await app.createLogFiles();
  app.logError("function startServer - test error log")
  app.sessions = new (require('./sessions.js'            ));   // keep track of sessions, requests and responses

  // start server loop
  http.createServer(app.requestIn.bind(app)).listen(app.config.port);
  console.log(`http:// Server using port: ${app.config.port}`);
}

startServer();
