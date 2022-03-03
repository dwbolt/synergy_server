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
  this.summaryFile;  // string for location of log file
}


//  logClass - server-side
// create log files if needed
async init() {
  // create log directory
  try {
    // creatre a new directory for the day
    await this.createLogStreams( app.config.logDir +"/"+ new Date().toISOString().substr(0,10) );
  } catch (e) {
    // if there is a problem with the log file, then an error will be generated on each server request/response cycle
    console.log("logClass.init err="+e);
  }
}


//  logClass - server-side
async createLogStreams(logDir) {
  // create new logfiles
  this.logDir = logDir;
  await app.verifyPath(this.logDir);  // create directory if it does not exist

  // will be overwriting this file
  this.fileSummary  = this.logDir+"/summary.json";

  // write CSV headers if the files are empty
  let stats,file;

  file = this.logDir+"/error.csv";
  this.fsError    = app.fs.createWriteStream(file,{flags: 'a'}); // will create it
  this.fsError.on('open', () => {
    stats = await app.fsp.stat(file);
    if (stats.size === 0) {
      // file empty, write the header
      this.fsError.write(`"Time Stamp","Session","Request","Message"\r\n`);
    }
  });


  file = this.logDir+"/request.csv";
  this.fsRequest  = app.fs.createWriteStream(file ,{flags: 'a'});
  this.fsRequest.on('open', () => {
    stats = await app.fsp.stat(file);
    if (stats.size === 0) {
      // file empty, write the header
      this.fsRequest.write(`"Time Stamp","Session","Request","Method","host","URL"\r\n`);
    }
  });

  file = this.logDir+"/response.csv";
  this.fsResponse = app.fs.createWriteStream(file,{flags: 'a'});
  this.fsResponse.on('open', () => {
    stats = await app.fsp.stat(file);
    if (stats.size === 0) {
      // file empty, write the header
      this.fsResponse.write(`"Time Stamp","Session","Request","Start","Last Request","Duration","ip","method","URL","Bytes"\r\n`);
    }
  });

  // if summary exist, then load it and init server info
  this.summaryFile = this.logDir + "/summary.json"
  await app.sessions.initSummary(this.summaryFile);
}


//  logClass - server-side
error(msg, request, response) {
  let sessionNumber=null,requestNumber=null;
  // append message to log file
  if (response) {
    // error was from request from user
    sessionNumber = response.synergyRequest.sessionNumber;
    requestNumber = response.synergyRequest.requestNumber;
  }
  this.write( this.fsError, `"${sessionNumber}","${requestNumber}","${msg}"` );
}


//  logClass - server-side
request(request,response) {
  // append message to log file
  this.write(this.fsRequest,`${response.synergyRequest.sessionNumber}, ${response.synergyRequest.requestNumber}, "${request.method}","${request.headers.host}","${request.url}"`);
}


//  logClass - server-side
response(obj){
  this.write(this.fsResponse,
      `${obj.sessionKey},${obj.requestNum},${obj.start},${obj.lastRequest},${obj.duration},"${obj.ip}","${obj.method}","${obj.url}",${obj.bytesSent}`
    );
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
}`

  // overwrite state of server to logfile
  await app.fsp.writeFile(this.summaryFile, obj);
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
