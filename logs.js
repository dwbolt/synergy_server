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

//  logClass - server-side
module.exports = class logsClass {


//  logClass - server-side
constructor () {
  // logging server & domain
  this.logDir;        // string for location of log file

  this.fsError;      // fs.writeStream  append
  this.fsRequest;    // fs.writeStream  append
  this.fsResponse;   // fs.writeStream  append
  this.fsSummary;    // string for location of log file
}


//  logClass - server-side
// reate log files if needed
async init() {
  // create log directory
  try {
    // creatre directory for the day
    const now    =  new Date();
    const logDir =  app.config.logDir +"/"+ now.toISOString().substr(0,10);
    if (!this.logDir ||  this.logDir != logDir ) {
      // create new logfiles
      this.logDir = logDir;
      await app.verifyPath(this.logDir);

      // create streams
      this.fsError    = app.fs.createWriteStream(this.logDir+"/error.cvs"   ,{flags: 'a'});
      this.fsRequest  = app.fs.createWriteStream(this.logDir+"/request.cvs" ,{flags: 'a'});
      this.fsResponse = app.fs.createWriteStream(this.logDir+"/response.cvs",{flags: 'a'});

      // will be overwriting this file
      this.dirSummary  = this.logDir+"/summary.json";

      // set timer to run cleanUp every second
  //    setInterval(this.cleanUp().bind(this), 1000);
    }
  } catch (e) {
    // if there is a problem with the log file, then an error will be generated on each server request/response cycle
    console.log("logClass.init err="+e);
  }
}


//  serverClass
error(msg) {
  // append message to log file
  if (this.fsError) {
    this.fsError.write(msg+'\n');
  }
}


//  logClass - server-side
request(requestNum, request) {
  // append message to log file
  if (this.fsRequest) {
    this.fsRequest.write(`${requestNum},"${request.method}","${request.url}"\n`);
  }
}


//  logClass - server-side
response(obj){
  if (this.fsResponse) {
    this.fsResponse.write(
      `${obj.requestNum},${obj.sessionKey},"${new Date(obj.start).toISOString()}",${obj.lastRequest},${obj.duration},"${obj.ip}","${obj.method}","${obj.url}",${obj.bytesSent}\n`);
  }
}


//  logClass - server-side
summary() {
  const o= app.sessions;
  const obj = `{
"serverStart"      : ${o.serverStart}
,"serverUpHr"      : ${(new Date()-o.serverStart)/(1000*60*60)}
,"MBSent"          : ${o.bytesSent/1000000}
,"requests"        : ${o.requests}
,"requestsOpen"    : ${o.openRequests.length}
,"sessionsTotal"   : ${o.sessionKey}
,"sesstionsActive" : ${Object.keys(o.sessions).length}
}`

  // overwrite state of server to logfile
  app.fsp.writeFile(this.dirSummary, obj);
}

//  logClass - server-side
} //////// end of class
