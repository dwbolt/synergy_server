// public
/*

class keeps track of user sessions, requests and response authentication

------------------------------ API
public

responseAddProxy( response, proxyObj ) - add to log  detail of proxy requests

private
initSession(sessionKey)                    - private, init Session attributes
initRequest(sessionKey, request, response) - private, intit Request object
parseCookies(request)                      - put cookies in an object so that they can be accessed easy

review
authorizedSubApp(subApp, request, response) {   // ?? used to login from html page
cleanUp()                                  - implemnet in future, setup to run on timer

-------------- future - not implement yet
server logs  // used for none real time analysis

  // not implemented yet
  requestsIn - all requests coming in get logged here
  response200Not - if a request has not
  console.log    - pm2 writes this to a log
  number of requestsIN and the sum of esponse200Not and response200 should be equal

  // implement in the future
  proxyRequestIn      -
  proxyResponse200    -
  prosyResponse200Not -
*/


// sessionsClass - server-side
module.exports = class sessionsClass {


// sessionsClass - server-side
constructor () {
    // used to see current state of the server in real time . the logfile logSummary is overwritten every cleanUp cycle
    // static
    this.serverStart  = Date.now();

    // load user autentication data
    this.users        = require(`${app.config.userDir}/users.json`);

    // requests
    this.requests     = 0    // increment each time a request comes in
    this.openRequests = {};  // Requests that are still processing
    this.lastRequest  =  Date.now();   // see how hard server is being hit
    this.sessionKey   = 0;   // increment each time a new session is started
    this.bytesSent    = 0;   // total bytes sent to clients since server started

    // open sessions
    this.sessions     = {};  // open sessions

    // set timer to run cleanUp every second
    setInterval(function() {
      this.cleanUp();
    }.bind(this), 1000);
}


// sessionsClass - server-side
getSessionData(
  obj        // obj ->
  ,request   // request ->
  ,response  // response ->
){  // public, return sessions object
  this.responseEnd(response, JSON.stringify(this));
}


// sessionsClass - server-side
// public, called from server.js when server request first comes in
log(
    request    // request ->
  , response   // response ->
) {
  // requests start here
  let sessionKey;
  // get cookie
  const cookie = this.parseCookies(request);

  // If the cookie has a serverStart attribute that matches the current server instance,
  // and it has a valid session key (one that's a key in this.sessions),
  // then go straight to initRequest. If any of that ISN'T true, start a new session first.
  if (!(cookie.serverStart && cookie.serverStart == this.serverStart
        && cookie.sessionKey && this.sessions[cookie.sessionKey])) {
          // start new session
          sessionKey = this.sessionKey++;
          this.initSession(sessionKey);
          response.setHeader('Set-Cookie', [`serverStart=${this.serverStart};path="/"`, `sessionKey=${sessionKey};path="/"`]);
  } else {
    // session key is valid
    sessionKey = cookie.sessionKey;
  }

  this.initRequest(sessionKey, request, response);
  response.setHeader('Access-Control-Allow-Origin', '*');       // 2022-02-17dwb what does this do?
}


// sessionsClass - server-side
// public, called to end response back to client
responseEnd(
   response  // response ->
  ,content   // content -> what is to be sent to browser client
) {
  // make request complete not written yet
  response.end(content);  // tell the client there is no more coming
  delete this.openRequests[response.harmonyRequest];  // remove from openRequest object
  const keys = response.harmonyRequest.split("-"); // key[0] is sessionKey  key[1] is reqestKey
  const obj = this.sessions[keys[0]].requests[keys[1]];
  obj.duration = Date.now() - obj.start;
  obj.bytesSent   = content.length;
  this.bytesSent += content.length;

  app.logResponse.write(`${JSON.stringify( obj )}\n`);
}


// sessionsClass - server-side
// public, used to login from html page
login(
   clientMsg // message from client
  ,request   // HTTPS request
  ,response  // HTTPS response
){
  const user = clientMsg.user;

  if (this.users[user] && this.users[user].pwdDigest === clientMsg.pwdDigest) {
    this.responseEnd(response,`{"msg":true, "nameFirst":"${this.users[user].nameFirst}", "nameLast":"${this.users[user].nameLast}"}`);
    // store user with their session
    // to be done
  } else {
    this.responseEnd(response,'{"msg":false}');
  }
}

// sessionsClass - server-side
logout(
   clientMsg // message from client
  ,request   // HTTPS request
  ,response  // HTTPS response
) {
  const user = userObj.user;

  // make sure user is logged into this sessions
  // to be done

  // remove user from their session
  // to be done
  this.responseEnd(response,`{"msg":true}`);

/*
  response.setHeader('Set-Cookie', [`serverStart="";Max-Age=0;path="/"`, `sessionKey="";Max-Age=0;path="/"`]);
  this.responseEnd(response, "Logged Out");
*/
}

// sessionsClass - server-side
// private, init Session object
initSession(
  sessionKey  // sessionKey ->
) {
  this.sessions[sessionKey]={};
  const s = this.sessions[sessionKey];

  s.userName    = "";  // userName if this is a logged in session
  /*  dwb 2022-02-17
  s.permissions = [];  // permission this session has - array of objects each representing permissions for one resource
  s.DB          = "";  // Name of the user's current database
  s.DBs         = [];  // List of all databases the user can access
  */
  s.requests    = [];  // requests made from this session
}


// sessionsClass - server-side
// sessionKey ->
// request  ->
// response ->
initRequest(sessionKey, request, response) { // private, intit Request object
  app.logRequest.write(`${++this.requests},"${request.method}","${request.url}"\n`);
  const now = Date.now();

  const obj = {    // request object to store
    "sessionKey"  : sessionKey
    ,"requestNum" : this.requests
    ,"start"      : now
    ,"lastRequest": now - this.lastRequest
    ,"duration"   : 0                                // will be replaced with milliseconds it took to process
    ,"ip"         : request.connection.remoteAddress // ip address that request came from
    ,"method"     : request.method                   // post, get, ...
    ,"url"        : request.url
  }

  this.lastRequest = now; // update to now, so we log time between now and next request
  const nextRequestKey = this.sessions[sessionKey].requests.length;
  const key = sessionKey +"-"+ nextRequestKey;
  this.openRequests[key]   = 0;                     // store request that is in process and that it just started procesing
  response.harmonyRequest = key;                    // store in response way to delete openRequest when it is done
  this.sessions[sessionKey].requests[nextRequestKey] = obj;  // store request in session
}


// sessionsClass - server-side
// response ->
// proxObj ->
responseAddProxy(response, proxObj) {
  const keys = response.harmonyRequest.split('-');
  this.sessions[keys[0]].requests[keys[1]].proxy = proxObj;
}


// 2022-02-17 potental bug, not sure what happens if cleanUp takes longer than a second to run say durring a garbage collection
// sessionsClass - server-side
// private - called every second to get rid of inactive sessions and requests
async cleanUp() {
  // see if any sessions need to be culled
  for (let sess in this.sessions) { // Go through all existing sessions
    const session = this.sessions[sess];
    const requests = session.requests; // Get the list of requests
    const now = Date.now();
    // If the LAST request is older than maxSessionAge, delete the session. Note: maxSessionAge is in minutes; must convert to ms
    let sessionAge = now - requests[requests.length -1].start;
    if (sessionAge > app.config.maxSessionAge.totalMilliSec) {
      // Remove any open requests associated with this session.
      for (let req in session.requests) {
        const key = sess +"-"+ req;
        delete this.openRequests[key]; // will delete the open request with this key if it exists, and will not fail if the request doesn't exist
      }
      delete this.sessions[sess];
    }
  }

  // overwrite state of server to logfile
  const content = `{
 "serverStart"     : ${this.serverStart}
,"serverUpHr"      : ${(new Date()-this.serverStart)/(1000*60*60)}
,"MBSent"          : ${this.bytesSent/1000000}
,"requests"        : ${this.requests}
,"sessionsTotal"   : ${this.sessionKey}
,"sesstionsActive" : ${Object.keys(this.sessions).length}
}`

  await app.fsp.writeFile(app.logSummary,content);
}


// sessionsClass - server-side
// private, put cookies in an object so that they can be accessed easily
parseCookies (
  request  // request ->
) {
  // https://stackoverflow.com/questions/3393854/get-and-set-a-single-cookie-with-node-js-http-server
  const list = {};
  let rc = null;

  if (request.headers) {
    rc = request.headers.cookie;
  }

  if (rc && rc.split(';').length > 2) {
    app.logError(`sessions.js parseCookies error`);
  }

  rc && rc.split(';').forEach(function( cookie ) {
      var parts = cookie.split('='); // Split the cookie at "=", so the first entry is the attribute name and the rest is the value
      // Remove the attribute name, trim off whitespace, and that's the key.
      //Join the rest of the array with "=" just in case it was split earlier (in case there was a = in the value),
      // decode it and that's the value.
      list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  return list;
}


// sessionsClass - server-side
parseSetCookies(
  response // response ->
) {
  const list = {};
  let rc = null;

  if (response._headers) {
    rc = response._headers['set-cookie'];
  }

  rc && rc.forEach(function( cookie ) {
      var parts = cookie.split('='); // Split the cookie at "=", so the first entry is the attribute name and the rest is the value
      // Remove the attribute name, trim off whitespace, and that's the key.
      const key = parts.shift().trim();
      // Join the rest of the array with "=" just in case it was split earlier (in case there was a = in the value),
      // cut it off at the first semicolon so that we don't get the path or other attributes as well, and decode it
      const value = decodeURI(parts.join('=').split(";")[0]);
      list[key] = value;
  });

  return list;
}


// sessionsClass - server-side
// ?? used to login from html page
/* dwb 2022-02-17
authorizedSubApp(
   subApp    // subApp
  ,request   // request ->
  ,response  // response ->
) {
  // get from database, for now hard code protection of harmony
  if (! subApp == "harmony") {
    return true;  // no authorization needed
  }

  const token  = request.headers.authorization;
  var username = "", password = "";

  // get username and password from header
  if (token) {
    const auth=Buffer.from(token.split(" ")[1], 'base64').toString()
    const parts=auth.split(/:/);                 // split on colon
    username=parts[0];
    password=parts[1];
  }

 if (username!=="amy") {
   response.writeHead(401);
   response.end("not authorized");
   return false;
 } else {
   return true;
 }
}
*/

// sessionsClass - server-side
checkCookies(
   request   // request
  ,response  // response
) {
  let sessionKey = null;

  let cookie = this.parseCookies(request); // If a session was already running, gets its cookie
  if (response._headers && response._headers['set-cookie']) { // If a session is being created for this request, gets its cookie
    cookie = app.sessions.parseSetCookies(response);
  }

  // If there is a valid cookie linked to a session running on this server
  if (cookie && cookie.serverStart && cookie.serverStart == this.serverStart && cookie.sessionKey && this.sessions[cookie.sessionKey]) {
    sessionKey = cookie.sessionKey;
  } else {
    // If there is no valid session, can't go any farther - just report the error
    app.logError("sessionsClass.checkCookies Error: No valid session running, could not log in");
    this.responseEnd(response, "No session"); // Send the phrase "No session" back to the client
  }

  return sessionKey;
}

/* dwb 2022-02-17
// sessionsClass - server-side

lookForResources(
  db     // db
  ,docs  // docs
) {
  let resources = [];
  docs.forEach(doc => {
    resources.push(app.removeDBSuffix(doc.data.k_toID));
  });

  const selector = {
    "selector": {
      "_id": {"$in": resources},
      "$or": [
        {"meta.d_deleted":0},
        {"meta.d_deleted":{"$exists":false}}
      ]
    },
    "limit":99
  };

  const obj = {"path": `/${db}/_find`, "method": "post"};

  return app.couchDB.request(obj, JSON.stringify(selector));  // Go look for all of that user's permissions. Permission is a relation FROM a person TO a resource.
}

*/


// sessionsClass - server-side
// relations  ->
// nodes ->
// direction ->
filterRelations(relations, nodes, direction) {
  const nodeIDs = nodes.map(x => x._id);
  return relations.filter(x => nodeIDs.includes(app.removeDBSuffix(x.data[`k_${direction}ID`])));
}


// sessionsClass - server-side
// db
// GUID
/* dwb 2022-02-17
lookForGUID(db, GUID) {
  const obj = {"path": `/${db}/_find`, "method": "post"};
  return app.couchDB.request(obj, `{"selector": {"_id": {"$eq": "${GUID}"}}}`);
}
*/



// sessionsClass - server-side
} //////// end
