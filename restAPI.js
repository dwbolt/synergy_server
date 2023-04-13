module.exports = class restAPI {  //  restAPI - server-side

/*
Create  - done with post
Read.   - done with get
Update  - done with put
Delete. - done with delete
*/


constructor () {  //  restAPI - server-side
  // load config file for syncvvv
  this.directoryRead = null  // will hold top level directory for manifest
}


async post( // restAPI - server-side
  // create resource - error if resouce already exists
   request      // HTTPS request
  ,response     // HTTPS response
  ,buffer       // binary data to create
){
  const hostName   = request.headers.host.split(":")[0];
  let   url        = request.url;

  // verify url starts with "/users/ and strip that off
  if ( url.substring(0,7) === "/users/") {
       url = url.substring(7);
  } else {
    // error, only allow upload to user space
    this.logs.error(`server.js uploadFile client tried uploading ${obj.path}`);
    this.sessions.responseEnd(response,'{"success":false, "message":"path must start with /users"}');
    return;
  }

  const pathWithfileName = `${app.config.hosts[hostName].users.filePath}/${app.sessions.getUserPathPrivate(response)}/${url}`;  // will include file name
  const pathA            = pathWithfileName.split("/");
  const path             = pathWithfileName.slice(0, pathWithfileName.length - pathA[pathA.length-1].length);  // remove file name

  try {
   await app.verifyPath(path); // create file path if it does not exists
   await app.fsp.writeFile(`${pathWithfileName}`, buffer); // save the file using app.fs.writeFile
   app.sessions.responseEnd(response,'{"success":true, "message":"file uploaded"}');
  } catch (e) {
    app.logs.error(`server.js uploadFile error = ${e}`);
    app.sessions.responseEnd(response,`{"success":false, "message":"error = ${e}"}`);
  }
}



} //   restAPI- server-side    //////// end of class
