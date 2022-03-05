// web server: static files and and API to webserver

// create server class and load configuration file
app = new (require('./server.js'))("../configHTTP");  // class where the work gets done

async function startServer() {
  await app.init();

  // start timers
  setInterval( app.sessions.cleanUp.bind(app.sessions), 1000);  // delete inactive sessions
  setInterval(     app.logs.summary.bind(app.logs    ), 5000);  // over write daily summary log

  app.logs.error(`server started`);  // only an error if pm2 is restarting sever

  // server listen for web requests
  app.http.createServer(app.requestIn.bind(app)).listen(app.config.port);
  console.log(`http:// Server using port: ${app.config.port}`);
}

startServer();
