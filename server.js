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

//  serverClass
module.exports = class serverClass {


//  serverClass
constructor (s_configDir) {
  // native nodejs modules
  this.https    = require('https')      ; // process https requests
  this.fsp      = require('fs/promises'); // access local file system
  this.fs       = require('fs')         ; // access local file system
  this.path     = require('path')       ; // used once (maybe use string function insead)
  this.uuidv1   = require('uuid/v1');   ; // Generate GUIDs - (can this be replaced with a native node function)

  this.config   = this.loadConfiguration(s_configDir);
  this.sessions;  // will point to sessionClass
  this.logs;      // will point to logsClass

  this.mimeTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.woff': 'application/font-woff',
      '.ttf': 'application/font-ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'application/font-otf',
      '.svg': 'application/image/svg+xml',
      '.docx': 'application/docx'
  };
}

logError(msg) {
  // append message to log file
  this.error.write(msg+'\n');
}

//  serverClass
async main() {
  // create log directory
  await this.logs.init();
}


//  serverClass
//  public: requests start here
requestIn(
   request
  ,response
) {
  this.sessions.log(request, response);   // log request in memory and in log files. Also add cookies for sessionKey and serverStart to response

  // make sure configuration file for web is loaded
  const host = request.headers.host.split(":")[0];  // get rid of port# if it is there
  if ( this.config.hosts[host] ) {
    if (request.method === "POST") {
      // talk to this web server or upstream server, return result to client
      this.POST(request, response);
    } else {
      // serve static file
      this.serveFile(request, response);
    }
  } else {
    // error, configuration file not loaded
    response.writeHead(200, { 'Content-Type': "text/html" });
    response.end(`configuration file: ${host}.json not found`);
    this.logError(`configuration file: ${host}.json not found`);
  }
}


//  serverClass
loadConfiguration(s_configDir) { // private:
  // configuration file
  const config  = require(`${s_configDir}/_config.json`);   // ports, domains served, etc on server
  config.maxSessionAge.totalMilliSec = 0;
  if (config.maxSessionAge.minutes) {config.maxSessionAge.totalMilliSec += config.maxSessionAge.minutes * 60 * 1000;}
  if (config.maxSessionAge.seconds) {config.maxSessionAge.totalMilliSec += config.maxSessionAge.seconds * 1000;}

  for(var h in config.hosts) {
    // load all domain configurations contained in _config.json
    try {
      const f = `./${s_configDir}/${h}.json`;
      console.log('loading configfile: '+ f);
      config.hosts[h]  = require(f);
    } catch (e) {
      // con not use logError, the directory to put the error log is located in the the configuration file, and loading it is where the error is.
      console.log(`server.js loadConfiguration  error=${e}`);
    }
  }
  return config;
}


//  serverClass
async serveFile(request, response) { // private:serve static file. could be html, JSON, etc
    // serve the default application
    const hostName = request.headers.host.split(":")[0];  // just want hostname, without port #
    const subApp = request.url.split("/")[1];             // get the directory or application name
    const subAppConfig = this.config.hosts[hostName].subApps[ subApp ];  // try to get config for an application
    let filePath;

    // create file ref from url
    let url = request.url;
    if (url.indexOf('?') > -1) {
      // remove any parametes on url
      url = url.slice(0,url.indexOf('?'));
    }
    if (url[url.length-1] === "/") {
      // add default html file if only a directory is given
      url += "app.html"
    }

    // find root server path
    if (subAppConfig) {
        filePath = subAppConfig.filePath;
        // take of subApp part of url
        url = url.substr(subApp.length+1);
    } else {
        filePath = this.config.hosts[hostName].filePath;
    }

    // complete server path to file
    filePath += url;

  // server file
  var extname = String(this.path.extname(filePath)).toLowerCase();
  var contentType = this.mimeTypes[extname] || 'text/html';

  let content;
  try {
      content = await this.fsp.readFile(filePath);
    //  response.setHeader('Cache-Control', 'max-age=300');
      response.setHeader('Cache-Control', `${app.config.CacheControl}`);
      response.writeHead(200, { 'Content-Type': contentType });
  } catch (e) {
    if(e.code == 'ENOENT'){
        // file not found
        response.writeHead(404, { 'Content-Type': contentType });
        content = `${filePath} - file not found`;
        this.logError(content);
    } else {
        // server error -- 500 is assumed, pull these from the error.()
        response.writeHead(500);
        content = 'Sorry, check with the site admin for error: ' +e.code;
        this.logError(content);
    }
  }

  app.sessions.responseEnd(response, content);
}


//  serverClass
// obj
// request
// response
web(obj, request, response) {  // private: process request
  if        ( typeof( this[         obj.msg] )=== "function") {
    // there is a serverClass method
    this[obj.msg](         obj, request, response);
  } else if ( typeof( this.sessions[obj.msg] ) === "function") {
    // there is a sessionsClass method
    this.sessions[obj.msg](obj, request, response);
  } else {
    // get error to user, add to server log
    this.logError( `"Error: server -> method 'web', message = '${obj.msg}"` );
  }
}


//  serverClass
// private:
POST(
   request  // request ->
  ,response  // response ->
) {
  let body = '';
  request.on('data', chunk => {
      body += chunk.toString(); // convert Buffer to string
  });
  request.on('end', () => {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/plain');
    try {
      var obj = JSON.parse(body);
    } catch (e) {
        this.logError(`Error server.js- JSON.parse = ${obj.server}`);
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
      default:
        // get error to user, add to server log
        this.logError(`Error server.js POST obj.server = ${obj.server}`);
    }
  });
}


//  serverClass
error(obj, request, response) {  // private:
  const data = obj.data;
  const errorObj = {
    "data": data,
    "method": "post"
  };

  this.couchdbProxy.request(errorObj, request, response, this.couchConfig.errorDB);
}


//  serverClass
getFromHarmonyByID(obj, request, response) { // private:
  const IDs = obj.IDs;
  const cookie = this.sessions.parseCookies(request);

  if (cookie.serverStart && cookie.serverStart == this.sessions.serverStart
      && cookie.sessionKey && this.sessions.sessions[cookie.sessionKey]) {
    const obj = {
      "path": `/${this.couchConfig.mainDB}/_find`,
      "method": "post"
    };

    const data = JSON.stringify({"selector": {"_id": {"$in":IDs}}});

    app.couchDB.request(obj, data) // see if userid, password match a user in db
    .then(function(result) {
      this.sessions.responseEnd(response, JSON.stringify(result));
    }.bind(this));
  } else {
    response.end("Not Logged In");
  }
}


//  serverClass
getFileNames(obj, request, response) {
  const data = obj.data;
  const directory = this.getDirectory(request);

  const path = `${directory}/${data.path}`;
  console.log(path);

  this.checkDirectory(path);
  const fileNames = this.fs.readdirSync(path);
  this.sessions.responseEnd(response, JSON.stringify(fileNames));
}



// class server
// added 2021-06-19 to save files for accounting app.

// obj      ->  message
// obj.path ->
// obj.name ->
// obj.extension ->
// obj.data ->
// request  ->
// response
async uploadFile(
  obj
  , request
  , response) {
  const hostName     = request.headers.host.split(":")[0];
  const subAppConfig = this.config.hosts[hostName].subApps[ obj.virDir ];  // try to get config for an application
  let directory      = `${this.config.hosts[hostName].filePath}`;
  if (subAppConfig) {
    directory = `${subAppConfig.filePath}`;
  }

  const path = `${directory}/${obj.app}/${obj.dir}`;

  try {
   await this.verifyPath(path) // create file path if it does not exists
   await this.fsp.writeFile(path, obj.data); // save the file using app.fs.writeFile
  } catch (e) {
    this.logError(`server.js uploadFile error = ${e}`);
  }
}


// class server
// public: Given a path, creates it if it doesn't already exists, and returns a promise that resolves when finished.
// used to create logs, etc...
async verifyPath(
  path  // string of path to create/verify
) {
  try {
    await this.fsp.mkdir(path, {recursive: true});
  } catch (e) {
    this.logError(`server.js verifyPath error = ${e}`);
  }
}


//  serverClass
} //////// end of class
