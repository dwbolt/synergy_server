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
// create log files if needed
async init() {
  // create log directory
  try {
    // creatre a new directory for the day
    const now    =  new Date();
    const logDir =  app.config.logDir +"/"+ now.toISOString().substr(0,10);

    if (!this.logDir) {
      // server startup
      await this.createLogStreams(logDir);
    } if (this.logDir != logDir ) {
      // The day has changed
        await this.createLogStreams(logDir);
              this.writeHeaders();
    }
  } catch (e) {
    // if there is a problem with the log file, then an error will be generated on each server request/response cycle
    console.log("logClass.init err="+e);
  }
}


//  logClass - server-side
async createLogStreams(logDir) {
  // create new logfiles
  this.logDir = logDir;
  await app.verifyPath(this.logDir);

  // create streams
  this.fsError    = app.fs.createWriteStream(this.logDir+"/error.csv"   ,{flags: 'a'});
  this.fsRequest  = app.fs.createWriteStream(this.logDir+"/request.csv" ,{flags: 'a'});
  this.fsResponse = app.fs.createWriteStream(this.logDir+"/response.csv",{flags: 'a'});

  // will be overwriting this file
  this.dirSummary  = this.logDir+"/summary.json";

  // write CSV headers if the files do not exist
  if (!app.fs.existsSync(this.logDir+"/error.csv")) {
    this.fsError.write(`"Time Stamp","Message"\r\n`);
  }
  if (!app.fs.existsSync(this.logDir+"/request.csv")) {
    this.fsRequest.write(`"Time Stamp","session","Request","Method","URL"\r\n`);
  }
  if (!app.fs.existsSync(this.logDir+"/response.csv")) {
    this.fsResponse.write(`"Time Stamp","Session","Request","Start","Last Request","Duration","ip","method","URL","Bytes"\r\n`);
  }

  // if summary exist, then load it and init server info
  if (app.fs.existsSync(this.dirSummary)) {
    await app.sessions.initSummary(this.dirSummary);
  }
}


//  logClass - server-side
error(msg) {
  // append message to log file
  this.write( this.fsError, `"${msg}"` );
}


//  logClass - server-side
request(session,requestNum, request) {
  // append message to log file
  this.write(this.fsRequest,`"${session}",${requestNum},"${request.method}","${request.url}"`);
}


//  logClass - server-side
response(obj){
  this.write(this.fsResponse,
      `${obj.sessionKey},${obj.requestNum},${obj.start},${obj.lastRequest},${obj.duration},"${obj.ip}","${obj.method}","${obj.url}",${obj.bytesSent}`
    );
}


//  logClass - server-side
summary() {
  const o= app.sessions;
  const obj = `{
"serverStart"      : "${new Date(o.serverStart).toISOString()}"
,"serverUpHr"      : ${(new Date()-o.serverStart)/(1000*60*60)}
,"bytesSent"       : ${o.bytesSent}
,"requests"        : ${o.requests}
,"sessionsTotal"   : ${o.sessionKey}
,"requestsOpen"    : ${o.openRequests.length}
,"sesstionsActive" : ${Object.keys(o.sessions).length}
}`

  // overwrite state of server to logfile
  app.fsp.writeFile(this.dirSummary, obj);
}


write(stream,msg){
  // adding date and convert to CSV format (commas and quotes to mssage)
  const m = `"${new Date().toISOString()}",${msg}\r\n`;

  if (stream) {
    // add end of line to mssage
    stream.write(`${m}`);
  } else {
    // log error to consle since stream does not exist (we have a bug if this happens)
    console.log(m);
  }
}


//  logClass - server-side
} //////// end of class
