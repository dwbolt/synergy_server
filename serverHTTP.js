// web server: static files and and API to webserver

// create server class 
// location of config file is passed in node serverHTTP -config  ../config/configHTTP
app = new (require('./server.js'))( "HTTP",process.argv[process.argv.indexOf('-config') + 1] );  // class where the work gets done

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
