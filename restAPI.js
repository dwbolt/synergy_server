module.exports = class restAPI {  //  restAPI - server-side

/*

Create  - done with post
Read.   - done with get
Update  - done with put - replace entire resource
Delete. - done with delete

Patch   - replae/add parts of a resource
*/


constructor () {  //  restAPI - server-side
  // load config file for syncvvv
  this.directoryRead = null  // will hold top level directory for manifest
}


async patch( // restAPI - server-side
  // this will append, review semantices, may want to change this in the futureå
  // update fields or attributes
   request      // HTTPS request
  ,response     // HTTPS response
){


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
    //if (request.headers["content-type"] === "application/octet-stream") {
    const hostName   = request.headers.host.split(":")[0];  // get hostName with out port
    let   url        = decodeURI(request.url);
  
    // verify url starts with "/users/ and strip that off
    if ( url.substring(0,7) === "/users/") {
          url = url.substring(7);
    } else {
      // error, only allow upload to user space
      app.logs.error(`file="restAPI" method="patch " request.url="${request.url}"`,request,response);
      app.sessions.responseEnd(response,'{"success":false, "message":"path must start with /users"}');
      return;
    }
  
    const pathWithfileName = `${app.config.hosts[hostName].users.filePath}/${app.sessions.getUserPathPrivate(response)}/${url}`;  // will include file name
  
    try {
    // will append to file, used currentlyf to csv,
      const stream    = app.fs.createWriteStream( pathWithfileName, {flags: 'a'}); // append to file
      stream.write(buffer);
      stream.end();
      app.sessions.responseEnd(response,'{"success":true, "message":"file patched"}');
    } catch (e) {
      app.logs.error(`file="restAPI.js" methos="patch" error ="${e}"`);
      app.sessions.responseEnd(response,`{"success":false, "message":"error = ${e}"}`);
    }
    //}
  });
}


async put( // restAPI - server-side
  // update file with a new version
   request      // HTTPS request
  ,response     // HTTPS response
  ,json         // data to change
){
  const hostName   = request.headers.host.split(":")[0];  // get hostName with out port
  let   url        = decodeURI(request.url);

  // verify url starts with "/users/ and strip that off
  if ( url.substring(0,7) === "/users/") {
       url = url.substring(7);
  } else {
    // error, only allow upload to user space
    app.logs.error(`file="restAPI" method="put" equest.url="${request.url}"`,request,response);
    app.sessions.responseEnd(response,'{"success":false, "message":"path must start with /users"}');
    return;
  }

  const pathWithfileName = `${app.config.hosts[hostName].users.filePath}/${app.sessions.getUserPathPrivate(response)}/${url}`;  // will include file name

  try {
   await app.fsp.unlink(`${pathWithfileName}`); // save the file using app.fs.writeFile
   app.sessions.responseEnd(response,'{"success":true, "message":"file deleted"}');
  } catch (e) {
    app.logs.error(`file="restAPI.js" method="put" error="${e}"`);
    app.sessions.responseEnd(response,`{"success":false, "message":"error = ${e}"}`);
  }
}


async delete( // restAPI - server-side
  // delete resource - error if resouce does not exists
   request      // HTTPS request
  ,response     // HTTPS response
){
  const hostName   = request.headers.host.split(":")[0];
  let   url        = decodeURI(request.url);

  // verify url starts with "/users/ and strip that off
  if ( url.substring(0,7) === "/users/") {
       url = url.substring(7);
  } else {
    // error, only allow upload to user space
    app.logs.error(`file="restAPI.js" method="delete" objec.path="${obj.path}"`,request,response);
    app.sessions.responseEnd(response,'{"success":false, "message":"path must start with /users"}');
    return;
  }

  const pathWithfileName = `${app.config.hosts[hostName].users.filePath}/${app.sessions.getUserPathPrivate(response)}/${url}`;  // will include file name

  try {
   const status = await app.fsp.lstat(pathWithfileName);  // see if we are deleted a folder or a file
   if        (status.isFile()) {
    await app.fsp.rm(`${pathWithfileName}`,{recursive: true}); // remove file
    //await app.fsp.unlink(`${pathWithfileName}`); 
    app.sessions.responseEnd(response,`{"success":true, "message":"file removed = ${pathWithfileName}"}`);
   } else if (status.isDirectory()) {
    await app.fsp.rm(`${pathWithfileName}`,{recursive: true}); // save the file using app.fs.writeFile
    app.sessions.responseEnd(response,`{"success":true, "message":"Direcotory removed = ${pathWithfileName}"}`);
   } else {
    app.logs.error(`file="restAPI.js" method="delete" error="${status}"`);
    app.sessions.responseEnd(response,`{"success":false, "message":"status= ${status}"}`);
   }
  } catch (e) {
    app.logs.error(`file="restAPI.js" method="delete" error="${e}"`);
    app.sessions.responseEnd(response,`{"success":false, "message":"error = ${e}"}`);
  }
}


async post( // restAPI - server-side
  // create resource - error if resouce already exists
   request      // HTTPS request
  ,response     // HTTPS response
  ,buffer       // binary data to create
){
  const hostName   = request.headers.host.split(":")[0];
  let   url        = decodeURI(request.url);

  // verify url starts with "/users/ and strip that off
  if ( url.substring(0,7) === "/users/") {
       url = url.substring(7);
  } else {
    // error, only allow upload to user space
    app.logs.error(`file="restAPI.js" method="post" url="${url}" can only update /users/ files`,request,response);
    app.sessions.responseEnd(response,'{"success":false, "message":"path must start with /users"}');
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
    app.logs.error(`file="restAPI.js" method="post" error = ${e}`);
    app.sessions.responseEnd(response,`{"success":false, "message":"error = ${e}"}`);
  }
}




} //   restAPI- server-side    //////// end of class
