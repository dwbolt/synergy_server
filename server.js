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
  resonse   - loggs a summery of the response along with the time it took to responseAddProxy  - append to each time a response ends
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
  this.sessions;  // will hold session class

  // logging
  this.logDir;        // string for location of log file
  this.logRequest;    // fs.writeStream
  this.logResponse;   // fs.writeStream
  this.logSummary;    // string for location of log file
  this.error;         // fs.writeStream

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


//  serverClass
async createLogFiles() {
  // create log directory
  try {
    const n     =  new Date();
    this.logDir =  app.config.logDir +"/"+ n.toISOString();

    await this.verifyPath(this.logDir);
    this.logRequest  = this.fs.createWriteStream(this.logDir+"/request.cvs" ,{flags: 'a'});
    this.logResponse = this.fs.createWriteStream(this.logDir+"/response.cvs",{flags: 'a'});
    this.error       = this.fs.createWriteStream(this.logDir+"/error.cvs"   ,{flags: 'a'});
    this.logSummary  = this.logDir+"/summary.cvs" ;

  } catch (e) {
    // if there is a problem with the log file, then an error will be generated on each server request/response cycle
    app.logError("serverClass.createLogFiles err="+e);
  }
}


//  serverClass
logError(msg) {
  // move this to the log file
  this.error.write(msg+'\n');
}

//  serverClass
//                       this is where it starts
// request ->
// response ->
requestIn(request, response) {  // public: requests start here
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
      this.logError(`server.js loadConfiguration  error=${e}\n`);
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

    let url = request.url;
    if (url.indexOf('?') > -1) {
      url = url.slice(0,url.indexOf('?')); // If there's a question mark, remove it and anything after it
    }

    if (subAppConfig) {
      // use subApps direcrtory
      if (subApp.length +2 == url.length ) {
        filePath = subAppConfig.filePath + "/app.html";
      } else {
        filePath = subAppConfig.filePath + url.substr(subApp.length+1);
      }
      // assume it requires login
      // if (! this.sessions.authorizedSubApp(subApp, request, response) ) return;  //
    } else {
      // use domain directory
      if (url === "/") {
        filePath = this.config.hosts[hostName].filePath +"/app.html" ;
      } else {
        filePath = this.config.hosts[hostName].filePath + url;
      }
    }

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
        content = 'Sorry, check with the site admin for error: ' +e.code+ '\n';
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
    this.logError( `"Error: server -> method 'web', message = '${obj.msg}"\n` );
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
      alert(e);
      return;
    }

    switch (obj.server) {
       case "web":
        this.web(                obj, request, response);
        break;
      case "pic":
        this.picServer.requestIn(obj, request, response);
        break;
      default:
        // get error to user, add to server log
        this.logError(`Error server.js POST obj.server = ${obj.server}\n`);
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
replicate(requestObj, request, response) { // private:
  const cookie = this.sessions.parseCookies(request);

  if (cookie.serverStart && cookie.serverStart == this.sessions.serverStart
      && cookie.sessionKey && this.sessions.sessions[cookie.sessionKey]) {

      this.sessions.initRequest(cookie.sessionKey, request, response);
      response.setHeader('Access-Control-Allow-Origin', '*');

      const obj = {
      "path": `/${this.config[this.config.couchDB].replicateDB}`,
      "method":   "post"}

      const protocol = this.config[this.config.couchDB].protocol;
      const host = this.config[this.config.couchDB].host;
      const port = this.config[this.config.couchDB].port;
      let portText = "";
      if (port) portText = `:${port}`;

      const url = `${protocol}//${host}${portText}`;
      const auth = this.config[this.config.couchDB].auth.split(":");
      let username = null;
      let password = "";
      if (auth.length > 1) {
        username = auth[0];
        password = auth[1];
      }

      const data = {
        "_id":this.uuidv1(),
        "user_ctx": {
          "name": username,
          "roles": [
            "_replicator",
            "_reader",
            "_writer"
          ]
        },
        "source": {
          "url": `${url}/${requestObj.from}`,
          "headers": {
          }
        },
        "target": {
          "url": `${url}/${requestObj.to}`,
          "headers": {
          }
        },
        "create_target": false,
        "continuous": false,
        "owner":username
      };

      if (requestObj.IDs) {
        data.doc_ids = requestObj.IDs;
      }

      if (requestObj.selector) {
        data.selector = requestObj.selector;
      }

      if (username && password) {
        data.source.headers.Authorization = "Basic " + Buffer(`${username}:${password}`).toString('base64');
        data.target.headers.Authorization = "Basic " + Buffer(`${username}:${password}`).toString('base64');
      }

      app.couchDB.request(obj, JSON.stringify(data))
      .then(function(answer) {
        this.sessions.responseEnd(response, JSON.stringify(answer));
      }.bind(this));
  } else {
    response.end("Not Logged In");
  }
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


//  serverClass
checkDirectory(path) {
  const steps = path.split("/");
  let partialPath = steps[0];
  steps.splice(0, 1);
  steps.forEach(function(step) {
    partialPath += `/${step}`;
    if (!this.fs.existsSync(partialPath)) {
      this.fs.mkdirSync(partialPath);
    }
  }.bind(this));
}


// class server
// obj      ->
// obj.path ->
// obj.data ->
// request  ->
// response ->
/*
upload(obj, request, response) {
  // convert app directoruy to OS direcrtory
  const hostName = request.headers.host.split(":")[0];
  const subApp = obj.path.split("/")[1];             // get the directory or application name
  const subAppConfig = this.config.hosts[hostName].subApps[ subApp ];  // try to get config for an application
  let directory = `${this.config.hosts[hostName].filePath}`;
  if (subAppConfig) {
    directory = `${subAppConfig.filePath}`;
  }

  const path = `${directory}/${obj.path}/${obj.name}.${obj.extension}`;

  let fileBinaryArray = [];
  Object.keys(obj.data).map(function(key){
    fileBinaryArray[key] = obj.data[key];
  });

  this.verifyPath(`${directory}/${obj.path}`) // Make sure the file path exists
  .then(this.callbackPromise.bind(this, app.fs.writeFile, path, Buffer.from(fileBinaryArray))) // save the file using app.fs.writeFile
  .then(app.sessions.responseEnd.bind(this, response, "Succeeded")) // Report success to the client
  .catch(function(err) { // Report failure to the client
    app.sessions.responseEnd(response, `Failed: ${err}`);
  }.bind(this));
}
*/

// class server
// added 2021-06-19 to save files for accounting app.

// obj      ->  message
// obj.path ->
// obj.name ->
// obj.extension ->
// obj.data ->
// request  ->
// response
async uploadFile(obj, request, response) {
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
    this.logError(`server.js uploadFile error = ${e}\n`);
  }
}


// class server
async verifyPath(path) { // public: Given a path, creates it if it doesn't already exists, and returns a promise that resolves when finished.
  try {
    await this.fsp.mkdir(path, {recursive: true});
  } catch (e) {
    this.logError(`server.js verifyPath error = ${e}\n`);
  }
}


// class server
/*
callbackPromise(func, ...args) { // public: converts any callback function to a promise which resolves or rejects when the function has run
  return new Promise(function(resolve, reject) {
    func(...args, function(err) {
      if (err) {
        this.logError(`server.js callbackPromise error = ${err}\n`);
        reject(err);
      } else resolve();
    }); // end callback and function
  }) // end Promise
}
*/

// class server
/*
saveEdit(obj, request, response) {
  const data = obj.data;
  const value = data.value;
  const user = data.user;
  const name = data.name || "_";
  const extension = data.extension || "JSON";
  const folder = data.folder || `Content/${data.page}/`;

  const path = `${this.getDirectory(request)}/${folder}${name}.${extension}`
  const now = new Date();
  let archive = `${this.getDirectory(request)}/${folder}${now.toLocaleDateString().replace(/\//g,'-')}_${name}_${user}.${extension}`;

  // First make sure the folder exists (since path and archive go in the same folder, I only need to do this once)
  this.verifyPath(`${this.getDirectory(request)}/${folder}`.slice(0,-1))
  .then(function() { // Then if the old file exists, move it to the archive
    if (this.fs.existsSync(path)) {
      return this.callbackPromise(this.fs.rename, path, archive);
    }
    else return Promise.resolve();
  }.bind(this))
  .then(this.callbackPromise.bind(this, this.fs.writeFile, path, value)) // Then write the new data to the current path
  .then(this.sessions.responseEnd.bind(this, response, "Succeeded")) // Then alert the user that the edit was saved successfully
  .catch(function(err) { // If there was a problem, log it and send the error message back to the user
    console.log(err);
    this.sessions.responseEnd(response, JSON.stringify(err));
  }.bind(this));
}
*/

// class server
getDirectory(request) {
  const hostName = request.headers.host.split(":")[0];
  const subApp = request.url.split("/")[1];             // get the directory or application name
  const subAppConfig = this.config.hosts[hostName].subApps[ subApp ];  // try to get config for an application
  let directory = `${this.config.hosts[hostName].filePath}`;
  if (subAppConfig) {
    directory = `${subAppConfig.filePath}`;
  }
  return directory;
}


// class server
removeDBSuffix (idString) {
	let newID = idString;
	if (typeof idString === "string") {
		const parts = idString.split("_X_");
		if (parts.length > 1) {
			parts.pop();
			newID = parts.join("_X_");
		}
	}

	return newID;
}


//  serverClass
addDBSuffix (idString, DB) {
	if (!DB) DB = this.login.DB;

	let newID = idString;
	if (typeof idString === "string" && idString.indexOf('_X_') === -1) {
		newID = `${idString}_X_${DB}`;
  }
	return newID;
}


//  serverClass
} //////// end of class
