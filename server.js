module.exports = class serverClass {   //  serverClass - server-side

/*

small web server that serves static files and supports an:

  API into web for :
  1) authentication
  2) resource accessed
  3) SPA (single page app) for accounting, messageing, clander, object database

requestIn(request, response) is called for each request comming in

in order for the system to keep track of sessions and requests, it is important to call
  app.sessions.responseEnd();
and NOT
  response.end();

This is because app.sessions.reponseEnd keeps track of the time it took for a request to finish.

Each time the server starts and new log directory is created with the name:  YYYY-MM-DD_time and the following files are created
  requests  - loggs all the request that came into the serverStart - appended to each time a request comes in
  resonse   - loggs a summery of the response along with the time it took to - append to each time a response ends
  error     - loggs all the errors - appended to each time an error occers
  summary   - every time a clean cyle happends the summary file is overwritten
    total requests
    total resonses
    total not responed to
    response time ,min, max, average
    total size of responses sendData
    total number of sessions
    max number of concurrent sessions
    number of unique users
*/


constructor ( //  serverClass - server-side
  )
   {
  // remember parameters
  this.config      = null // will load during this.init()

  // native nodejs modules
  this.https     = require('https')      ; // process https requests
  this.http      = require('http')       ; // process https requests
  this.fsp       = require('fs/promises'); // access local file system with promises
  this.fs        = require('fs')         ; // access local file system
  this.path      = require('path')       ; // used once (maybe use string function insead)

  this.mimeTypes = {
      '.html': 'text/html',
      '.js'  : 'text/javascript',
      '.css' : 'text/css',
      '.json': 'application/json',
      '.pdf' : 'application/pdf',
      '.png' : 'image/png',
      '.jpg' : 'image/jpg',
      '.ico' : 'image/x-icon',
      '.gif' : 'image/gif',
      '.wav' : 'audio/wav',
      '.mp4' : 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf' : 'application/font-ttf',
      '.eot' : 'application/vnd.ms-fontobject',
      '.otf' : 'application/font-otf',
      '.svg' : 'application/image/svg+xml',
      '.docx':'application/docx',
      '.txt' : 'text/plain'
  };

// keep this inplace until the old wix urls are not being used
  this.redirectData = {
    "makersmarket"        : "p=makers-market"
    ,"become-a-member"    : "p=member"
    ,"library"            : "p=library"
    ,"visit-us"           : "p=visit"
    ,"donation"           : "p=donate"
    ,"about-us"           : "p=about"

    ,"sustainable-future-llc" : "p=solar"
    ,"permaculture-ethics"    : "p=permaEthics"
    ,"permaculture-principles": "p=permaPrinciples"

    ,"bylaws"             : "synergyData/documents/bylaws.pdf"

    ,"makers-market-registration" : "p=makers-market&b=Vendor%20Registration"


    ,"buy-microgreens"  : "p=page-not-on-website"
    ,"market-music"     : "p=page-not-on-website"
    ,"community-thrives": "p=page-not-on-website"
    ,"flowjam"          : "p=page-not-on-website"
    ,"our-work"         : "p=page-not-on-website"
    }
}


async startServer() {   //  serverClass - server-side
  this.configFile   = process.argv[process.argv.indexOf('-config') + 1];  // get config file path from command line
  this.config       = this.loadConfiguration();                           // load config for server and domains

  this.sessions = new (require('./sessions.js'));   // keep track of sessions, requests and responses
  this.logs     = new (require('./logs.js'    ));   // logs
  this.sync     = new (require('./sync.js'    ));   // support clients server sync with other clients
  this.restAPI  = new (require('./restAPI'    ));

  await this.logs.init();

  // start timers
  setInterval( app.sessions.cleanUp.bind(app.sessions), 1000);  // delete inactive sessions
  setInterval(     app.logs.summary.bind(app.logs)    , 5000);  // over write daily summary log

  app.logs.error(`server started`);  // only an error if pm2 is restarting sever

  // server listen for web requests
  if ( this.config.protocol === "HTTPS" ) {
    this.https.createServer(
      {
      // https certificates for encription
      key:  this.fs.readFileSync(`${this.config.certificates}/private.key.pem`)
     ,cert: this.fs.readFileSync(`${this.config.certificates}/domain.cert.pem`)
     ,ca:   this.fs.readFileSync(`${this.config.certificates}/intermediate.cert.pem`)
      },this.requestIn.bind(app)
    ).listen(this.config.port);
  } else if ( this.config.protocol === "HTTP" ){
    this.http.createServer(this.requestIn.bind(app)).listen(this.config.port);
  } else {
    app.logs.error(`server.startServer - protocol =${this.config.protocol} is not supported`);  // only an error if pm2 is restarting sever
  }

  // will apear in pm2 logs - along with any error messeges if the loggin object has an error
  console.log(`${this.config.protocol}:// Server using port: ${this.config.port}`);
}


requestIn(  //  serverClass - server-side
//  public: requests start here
   request  //
  ,response //
) {
  if (typeof(request.headers.host) === "undefined") {
    // not sure how a request can come in withoht a host, but about 6 a day come in and crash the server.  This prevents the requests from crashing the server
    app.sessions.headerUndefined++; // keep track of how many come in
    return;   // do not process request
  }

  this.sessions.log(request, response);   // log request in memory and in log files. Also add cookies for sessionKey and serverStart to response

  // make sure configuration file for web is loaded
  const host = request.headers.host.split(":")[0];  // get rid of port# if it is there
  if ( !this.config.hosts[host] ) {
    // error, configuration file not loaded
    response.writeHead(200, { 'Content-Type': "text/html" });
    this.sessions.responseEnd(response,`server is not configured for domain ${host}`);
    app.logs.error(`configuration file: ${host}.json not found`,request,response);
    return;
  }

  // process request
  switch(request.method ) {
    case "GET":
      if ( !this.redirect(request, response) ) {  // see if a redirect has been defined
        this.serveFile(request, response); // serve static file
      }
      break;

    case "POST":
      // talk to this web server or upstream server, return result to client
      this.POST(request, response);
      break;

    case "OPTIONS":
      // let client know the types of request that the server will process
      response.writeHead( 204, { 
        "access-control-allow-methods" : "POST, GET, PUT, DELETE, PATCH"
      ,"Access-Control-Allow-Origin"   : "*" 
      ,"Access-Control-Allow-Headers"  : "Content-Type, Authorization"
      } )
      this.sessions.responseEnd(response); 
      break;

    case "PUT":
      this.restAPI.put(request, response); // update by replaceing entire resource
      break;

    case "PATCH":
      this.restAPI.patch(request, response); // update just some attribute
      break;

    case "DELETE":
      this.restAPI.delete(request, response); // delete
      break;

     default:
      // method not supported
      response.writeHead(400, { 'Content-Type': "text/html" });
      this.sessions.responseEnd(response,`server does not support method  ${request.method}`);
      app.logs.error(`server does not support method  ${request.method}`,request,response);
  }
}


loadConfiguration(  //  serverClass - server-side 
  ) { 
  // load main configuration file
  const config  = require(process.cwd()+"/"+this.configFile);   // ports, domains served, etc on server

  // allow for local config overide of config params
  let configLocal = config.localConfig;       // points to local file config, allows override of main config 
  if (configLocal) {
    configLocal = require(configLocal); // load local config file
    Object.keys(configLocal).forEach((key, index) => {
      // copy local config attrubuts to main config
      config[key] = configLocal[key];
     });
  }
  
  // calculate maxSessionAge in milli seconds
  config.maxSessionAge.totalMilliSec = 0;
  if (config.maxSessionAge.minutes) {config.maxSessionAge.totalMilliSec += config.maxSessionAge.minutes * 60 * 1000;}
  if (config.maxSessionAge.seconds) {config.maxSessionAge.totalMilliSec += config.maxSessionAge.seconds * 1000;}

  // load domain directory paths and make sure they are there
  // domain configuration files are in the same directrory as the main config file
  const s_configDir = this.configFile.substring(0, this.configFile.search("_config.json") )
   // load configurative file for each domain
  for(var h in config.hosts) {
    // load all domain configurations contained in _config.json
    try {
      const f = `${process.cwd()}/${s_configDir}${config.hosts[h]}.json`;  // get file name
      console.log("");
      console.log(`domain:   ${h}`);
      console.log(`  loading ${f}`);
      if (this.fs.existsSync(f)) {
        // domain config file exists
        config.hosts[h]  = require(f);
        this.checkDomainDirectories(config.hosts[h]); 
      } else {
        console.log(`  domain file does not exist ${f} ********`);
      }
    } catch (e) {
      // can not use logError, the directory to put the error log is located in the the configuration file, and loading it is where the error is.
      console.log(`server.js loadConfiguration  error=${e}`)
    }
  }

  // allow port to be changed from command line
  let paramIndex = process.argv.indexOf('-port') + 1;
  if ( 0<paramIndex && process.argv[paramIndex]) {
    // port was set from command line
    config.port = process.argv[paramIndex];  
  }

  // allow protocol to be changed from command line
  paramIndex = process.argv.indexOf('-protocol') + 1;
  if ( 0<paramIndex && process.argv[paramIndex]) {
    // port was set from command line
    config.protocol = process.argv[paramIndex];  
  }

  return config;
}


checkDomainDirectories(  //  serverClass - server-side
  domainConfig  // make sure all directories in config file exist
  ) {
  const spaces = "                 ";
  for(var key in domainConfig) {
    const webkey = `   domain directory "${key}" ${spaces.slice(0,15-key.length)} = `;
    if (this.fs.existsSync(domainConfig[key].filePath)) {
      console.log(`${webkey}${domainConfig[key].filePath} exists`)
    } else {  
      console.log(`${webkey}${domainConfig[key].filePath} does not exist **********`)
    }
  }
}


redirect( //  serverClass - server-side
    request
  , response
  ) {
    // strip off leading / and covert to lowercase
    const  url = request.url.substr(1).toLowerCase();

    if( this.redirectData[url] ) {
      // we found a redirect
      const content = `
        <meta http-equiv="Refresh" content="5; url='/app.html?${this.redirectData[url]}'" />
        <h1><br/><br/>This page has a new location<br><br><a href="/app.html?${this.redirectData[url]}">/app.html?${this.redirectData[url]}</a><br/><br/>
        new page should load in 5 seconds.<br>You may click the link if the redirect fails to work</h1>`;
      app.sessions.responseEnd(response, content)
      return true;
    } else {
      // did not find a redirect
      return false;
    }
}


getFilePath( //  serverClass - server-side
  // convert URL to local server file path
   request
  ,response
  ) {  // return local file path for url
  let url = new URL(app.config.protocol +"://"+ request.headers.host + request.url);  // take care of convert %20 and other escape chacrters to string

  //const hostName     = request.headers.host.split(":")[0];    // just want hostname, without port #
  const hostName     = url.hostname;    // just want hostname, without port #
  const subApp       = url.pathname.split("/")[1];             // get the directory or application name, if at root level, will be filename
  const subAppConfig = (subApp === "user" ? 
    this.config.hosts[hostName][ "users" ] :    // "user" uses the the same starting bases as "users" - this code allows only "users" to be set in the domain config file
    this.config.hosts[hostName][ subApp  ])      // try to get config for an application, will be undefined if at root level

  if (url.pathname.length === 1) {
    // add default html file if only a directory is given
    url.pathname += "app.html";
  }

  // find root server path
  let filePath;
  if (subAppConfig) {
      if (0<url.pathname.length) {
        // take off subApp part of url
        url.pathname = url.pathname.slice(subApp.length+1);
      }

      // default case, subApp in config file
      filePath = subAppConfig.filePath;

      if (subApp === "users") {
        // make sure they are logged in, then add their subdirectory
        filePath += "/"+ this.sessions.getUserPathPrivate(response);
      } else if (subApp === "user") {
        // look at user profile makeing and allow acces to public directories.
        filePath += "/"+ this.sessions.getUserPathPublic(filePath, url); 
      } else if (subAppConfig.class) {
        // don not think this is this used now - dwb
        filePath  = app[subAppConfig.class].getFilePath(request,response); 
      }
  } else {
    filePath = this.config.hosts[hostName][""].filePath;  // get the default path
  }

  return filePath+url.pathname;
}


getSubAppPath( // sessionsClass - server-side
   subApp
  ,request
  ){
  const hostName = request.headers.host.split(":")[0];            // just want hostname, without port #
  return  this.config.hosts[hostName][ subApp ].filePath; // try to get config for an application
}


async serveFile(  //  serverClass - server-side
  request
  , response
  ) { // private:serve static file. could be html, JSON, etc
  const filePath = this.getFilePath(request, response);

  // lookup mimeType
  var extname = String(this.path.extname(filePath)).toLowerCase();
  var contentType = this.mimeTypes[extname] || 'text/html';

  // server file
  let content;
  try {
      content = await this.fsp.readFile(filePath);
      response.setHeader('Cache-Control', `${app.config.CacheControl}`);
      response.writeHead(200, { 'Content-Type': contentType });
  } catch (e) {
    if(e.code == 'ENOENT'){
        // file not found
        response.writeHead(404, { 'Content-Type': contentType });
        content = `
          <meta http-equiv="Refresh" content="0; url='/app.html?p=page-not-found&url=${request.url}'" />
          <p>Redirect to new url</p>`;
        app.logs.error(`app.serveFile() file not found - ${filePath}`,request, response);
    } else {
        // server error -- 500 is assumed, pull these from the error.()
        response.writeHead(500);
        content = `
          <meta http-equiv="Refresh" content="0; url='/app.html?p=page-server-error'" />
          <p>Redirect to new url</p>`;
        this.logs.error(`app.serveFile() err=${e.code} file=${filePath}`);
    }
  }

  app.sessions.responseEnd(response, content);
}


async uploadFile(  // class server - server-side
  // not tested for binary files
  obj   // obj      ->  message
  /*  {"server":"web"
    ,"msg":"uploadFile"
    ,"path":"/users/server/download"
    ,"name":"test.json"
    ,"dataType": "json"
    ,"data":"${data}"
  }*/
  , request  // request  ->
  , response // response
  ) {
  const hostName     = request.headers.host.split(":")[0];

  // verify obj.path starts with "/users/ and strip that off
  if (        obj.path.substring(0,7) === "/users/") {
    obj.path = obj.path.substring(7);
  } else {
    // error, only allow upload to user space
    this.logs.error(`server.js uploadFile client tried uploading ${obj.path}`);
    this.sessions.responseEnd(response,'{"success":false, "message":"path must start with /users"}');
  }

  const directory = this.config.hosts[hostName].users.filePath;  // only allow upload to user area
  let path = `${directory}/${this.sessions.getUserPathPrivate(response)}/${obj.path}`;

  try {
   await this.verifyPath(path) // create file path if it does not exists
   if (typeof(obj.data) === "object") {
     // assume data is json and convert to string
     obj.data = JSON.stringify(obj.data);
   }
   await this.fsp.writeFile(`${path}/${obj.name}`, obj.data); // save the file using app.fs.writeFile
   this.sessions.responseEnd(response,'{"success":true, "message":"file uploaded"}');
  } catch (e) {
    this.logs.error(`server.js uploadFile error = ${e}`);
    this.sessions.responseEnd(response,`{"success":false, "message":"error = ${e}"}`);
  }
}


async userFile(  //  serverClass - server-side
  obj, request, response) {

}


async web(  //  serverClass - server-side
  // private: process request
   obj
  ,request
  ,response
  ) {
  switch (obj.msg) {
  case "login":
    this.sessions.login(       obj, request, response);
    break;

  case "logout":
    this.sessions.logout(       obj, request, response);
    break;

  case "changePWD":
    this.sessions.changePWD(    obj, request, response);
    break;

  case "addUser":
    await this.sessions.addUser(obj, request, response );
    break;

  case "sync":
    await this.sync.manifest(     obj, request, response);
    break;

  case "uploadFile":
    await this.uploadFile(     obj, request, response);
    break;

  default:
    app.logs.error( `"Error: server.web, message = '${obj.msg}"`       ,request, response );
  }
}


// private:
POST(        // serverClass - server-side
   request   // request ->
  ,response  // response ->
) {
  let body = '';
  let i=0;
  let buffer = new Uint8Array (request.headers["content-length"]); 

  request.on('data', chunk => {
    if (request.headers["content-type"] === "application/octet-stream") {
      // binary
      for( let n=0; n<chunk.length; n++) {
        buffer[i++]=chunk[n];  // add chunk to buffer
      }
    } else {
      // assume string
      body += chunk.toString(); // convert Buffer to string
    }

  });
  
  request.on('end', () => {
    if (request.headers["content-type"] === "application/octet-stream") {
      // assume REST API post
      this.restAPI.post(request,response,buffer);
      return;
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    try {
      var obj = JSON.parse(body);  // covert string to a json object
    } catch (e) {
        this.logs.error(`serverClass.POST - body = ${body}`);
      return;
    }

    switch (obj.server) {
       case "web":
        this.web(obj, request, response);
        break;
        /*
      case "pic":
        this.picServer.requestIn(obj, request, response);
        break;*/
      case "sync":
        this.sync.direct(obj, request, response);
        break;
      default:
        // get error to user, add to server log
        app.logs.error(`Error server.js POST obj.server = ${obj.server}`, request, response);
    }
  });
}


async verifyPath(   // serverClass - server-side
// public: Given a path, creates it if it doesn't already exists, and returns a promise that resolves when finished.
// used to create logs, etc...
  path  // string of path to create/verify
) {
  try {
    await this.fsp.mkdir(path, {recursive: true});
  } catch (e) {
    app.logs.error(`erverClass.verifyPath error = ${e}`);
  }
}


userData(){ // class server return user data

}


} //  serverClass - server-side  //////// end of class


app = new (require('./server.js'));  // class where the work gets done
app.startServer();