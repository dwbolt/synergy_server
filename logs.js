module.exports = class logsClass {  //  logClass - server-side
  
/*

every request,response and error is Logged
A server can process requests from multiple domains. Each domain can have it's own logfile directory.

domain1
  log
    day1
      requests
      responces
      error
      summary
    day2 ..
domain 2...

the summary log file is overwritten every second with the totals done for the day.
the other log files are append to

if the server restarts it reads the summary file and continues to add to the totals

every second the create() function runs to se

*/


constructor () {  //  logClass - server-side
  // logging server & domain
  this.logDir     = app.config.logDir;        // string for location of log file
}


async init() {  
  // create log directory
  try {
    // creatre a new directory for the day
    const dir = app.config.logDir +"/"+ new Date().toISOString().slice(0,10);
    await app.verifyPath(dir);
    //this.fileStatus = 0;

    this.fsError    = app.fs.createWriteStream(dir + "/error.njs"   , {flags: 'a'});
    this.fsRequest  = app.fs.createWriteStream(dir + "/request.njs" , {flags: 'a'});
    this.fsResponse = app.fs.createWriteStream(dir + "/response.njs", {flags: 'a'});
    this.summaryFile=                          dir + "/summary.json";  // string for location of log file

    await app.sessions.initSummary(this.summaryFile);
  } catch (e) {
    // if there is a problem with the log file, then an error will be generated on each server request/response cycle
    console.log("logClass.init err="+e);
  }
}

/*
ready(file) {  //  logClass - server-side
  console.log(++this.fileStatus);
}
*/


error(msg, request, response) {  //  logClass - server-side
  let sessionNumber=null,requestNumber=null;
  // append message to log file
  if (response) {
    // error was from request from user
    sessionNumber = response.synergyRequest.sessionNumber;
    requestNumber = response.synergyRequest.requestNumber;
  }
  this.write( this.fsError,  [sessionNumber, requestNumber, msg] );
}


request(request,response) {  //  logClass - server-side
  // append message to log file
  this.write(this.fsRequest,[this.to_number(response.synergyRequest.sessionNumber), response.synergyRequest.requestNumber, request.method, request.headers.host, request.url]);
}


response(obj){  //  logClass - server-side
  this.write(this.fsResponse, [this.to_number(obj.sessionKey), obj.requestNum, obj.start, obj.lastRequest, obj.duration, obj.ip, obj.method, obj.url, obj.bytesSent]);
}


to_number(obj) { //  logClass - server-side
  const t = typeof(obj);
  switch (t) {
    case "number":
      return obj
      break;

    case "string":
      return parseInt(obj)
      break;
  
    default:
      // error
      this.error(`file="logs.js", method="to_number", t="${t}"`);
      break;
  }
}


//  logClass - server-side
async summary() {
  const o= app.sessions;
  const obj = `{
"serverStart"      : "${new Date(o.serverStart).toISOString()}"
,"serverUpHr"      : ${(new Date()-o.serverStart)/(1000*60*60)}
,"bytesSent"       : ${o.bytesSent}
,"requests"        : ${o.requests}
,"sessionsTotal"   : ${o.sessionKey}
,"requestsOpen"    : ${o.openRequests.length}
,"sesstionsActive" : ${Object.keys(o.sessions).length}
,"headerUndefined" : ${o.headerUndefined}
}`

  // overwrite state of server to logfile
  await app.fsp.writeFile(this.summaryFile, obj);
}


write(stream, json_array){
  // adding date and convert to CSV format (commas and quotes to mssage)
  json_array.push(new Date().toISOString());  // add server timespame
  const m = JSON.stringify(json_array) + `\n`  // add newline so file can be parsed

  if (stream) {
    stream.write(m);
  } else {
    // log error to consle since stream does not exist (we have a bug if this happens)
    console.log(m);
  }
}


//  logClass - server-side
} //////// end of class
