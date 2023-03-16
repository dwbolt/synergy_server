// web server: static files and and API to webserver

// create server class and load configuration file
//app = new (require('./server.js'))("../config/configHTTPS");  // class where the work gets done

// location of config file is passed in node serverHTTP -config  ../config/configHTTPS
app = new (require('./server.js'))(process.argv[process.argv.indexOf('-config') + 1]);  // class where the work gets done

async function startServer() {
  await app.init();

  // start timers
  setInterval( app.sessions.cleanUp.bind(app.sessions), 1000);  // delete inactive sessions
  setInterval(     app.logs.summary.bind(app.logs    ), 5000);  // over write daily summary log

  app.logs.error(`server started`);  // only an error if pm2 is restarting sever

  // server listen for web requests
  app.https.createServer(
    {
    // https certificates for encription
    key:  app.fs.readFileSync('../config/certificates/private.key.pem')
   ,cert: app.fs.readFileSync('../config/certificates/domain.cert.pem')
   ,ca:   app.fs.readFileSync('../config/certificates/intermediate.cert.pem')
    },app.requestIn.bind(app)
  ).listen(app.config.port);

  // will apear in pm2 logs - along with any error messeges if the loggin object has an error
  console.log(`https:// Server using port: ${app.config.port}`);
}

// init web server and start listening for rquests
startServer();
