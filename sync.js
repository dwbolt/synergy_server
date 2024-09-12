module.exports = class sync {  //  sync - server-side

/*

sync allow working offline on local computer and syncing changed files with other computers. It is simialr to google drive

Bugs-
  create /syc/{new machine folder}
*/


constructor () {  //  sync - server-side
  // load config file for syncvvv
  this.directoryRead = null  // will hold top level directory for manifest
}


async direct( //  sync - server-side
    msg  
  ,request      // HTTPS request
  ,response     // HTTPS response
){

  switch (msg.method) {
    case "manifest":
      this.manifest(msg,request,response);
      break;
  
    default:
      app.logs.error( `"Error: server.sync.direct message = '${obj}"`       ,request, response );
  }
}


async dir(   //sync - server-side
  // return info about files in direcory url
  msg  // msg.server : sync
       // msg.method      : dir
       // msg.url :
,request      // HTTPS request
,response     // HTTPS response
) {
  let   success                = true;
  const obj                    = []                                                         ; // lit of fles and responses to return
  request.url                  = msg.url                                                    ; // not sure of side effects on changing value
  const directoryRead          = decodeURIComponent(await app.getFilePath(request,response)); // may contain url esc charactor, need to remove
  const childOfHiddenDirectory = false                                                      ; // do not include hidden files

  let files = [];
  try {
    files = app.fs.readdirSync(directoryRead)                                           ;  // get list of all files in directory
  } catch (error) {
    success = false;
    // log error on server - 
    app.logs.error(error,request,response);  // only an error if pm2 is restarting sever
  }

  // walk each file in directory
  files.forEach((file) => {
    const dirFile = `${directoryRead}/${file}`;
    const stat    = app.fs.statSync(dirFile);  // should this be converted to a an async version?

    // there are probabliy more cases than this
    if (stat.isSymbolicLink()) {
      // not sure what todo about this
      //this.totalLinks++;
      //this.streamL.write(`"${dirFile}"\r\n`);
    }

    if (stat.isDirectory()) {
      // create csv of directorys
      if (file[0]==='.' || childOfHiddenDirectory) {
        // hidden directory - ignor
       // this.totalHidden++;
       // this.streamH.write(`"${dirFile}"\r\n`);
       // this.getAllFiles(dirFile, true );   // recursice
      } else {
        // not hidden directory
        obj.push([file,true,stat]);
      }
    } else if (file[0]==='.' || childOfHiddenDirectory) {
      // hidden file or childOfHiddenDirectory
      //this.totalHidden++;
      //this.streamH.write(`"${dirFile}"\r\n`);
    } else {
      // assume a regulare file
      obj.push([file,false,stat]);

      // inode,size, disk size,"last access date", creation date", "path with file name"
      //let url="do to";
      //let dirFileRel = dirFile.slice( this.directoryRead.length);
      //this.stream.write(`${stat.ino},${stat.size},${stat.blksize*stat.blocks},"${stat.birthtime.toUTCString()}","${stat.mtime.toUTCString()}","${stat.atime.toUTCString()}","${dirFileRel}","${dirFile}","${url}"\r\n`);
      //this.totalFiles++;
    }
  });

  // give client statues
  app.sessions.responseEnd(response, JSON.stringify({"msg": success, "files": obj}));

}


async manifest( //  sync - server-side
   msg  // msg.server : sync
        // msg.method  : manifest
        // msg.type : client2server  | client2client      
        // msg.direcotry : attribute of client2server or client2client in config file that points to local directory that a manifest list is being created for
  ,request      // HTTPS request
  ,response     // HTTPS response
) { 

  // set direcotryWrite  and directoryRead
  let directoryWrite // where meta data is stored about all the files in directoryRead 
  let config={};  

  if         (msg.type === "client2server") {
      if        (msg.location === "local") {
        this.directoryRead  =  app.sessions.getLocalUserDir(request, msg.user);
        directoryWrite      = `${this.directoryRead}/sync/${app.config.machine}`;  // assume userid for remote is same as userid for local  
      } else if (msg.location === "remote") {
        // manifes for remote serverthe one logged into  
        this.directoryRead  = app.getFilePath(request,response);
        directoryWrite      = `${this.directoryRead}/sync/${app.config.machine}`; // local dirtory to generate manifest fils
      } else {
        // error
        console.log(`error: sync.js   manifes() msg= ${msg} `)
        return;
      }
  } else if (msg.type === "client2client") {
      //
    return;
  } else {
    // error in vailid msg.type
    return;
  }
  

  // get local path to direcotry were are creating manifest files for
  try {
    // init counters
    this.totalDir    = 0;
    this.totalFiles  = 0;
    this.totalLinks  = 0;
    this.totalHidden = 0;

    await this.generateFiles(directoryWrite, this.directoryRead, request, response);  //
    
    // give client statues
    app.sessions.responseEnd(response, `
    {
     "msg"     : true
    ,"machine" : "${app.config.machine}"
    ,"files"   : ["1-manifest.csv","2-dir.csv","3-links.csv","4-Hidden.csv"]
    }`);
  } catch(e) {
    console.log(e);   // need to be logged
  }
}


async generateFiles(//  sync - server-side
 directoryWrite     // where manifest files will be written
,directoryRead      // directory that meta data is about
,request      // HTTPS request
,response     // HTTPS response
) {
    // delete/create machine directory
    await app.fsp.rm(   directoryWrite, { recursive: true ,force: true});  // ignore errow if it does not exist
    await app.fsp.mkdir(directoryWrite, { recursive: true });              // should have an empty directory now

    // create streams
    this.stream   = app.fs.createWriteStream( `${directoryWrite}/1-manifest.csv`  , {flags: 'a'});  // append to end of file
    this.streamD  = app.fs.createWriteStream( `${directoryWrite}/2-dir.csv`       , {flags: 'a'});  // append to end of file
    this.streamL  = app.fs.createWriteStream( `${directoryWrite}/3-links.csv`     , {flags: 'a'}); // append to end of file
    this.streamH  = app.fs.createWriteStream( `${directoryWrite}/4-Hidden.csv`    , {flags: 'a'}); // append to end of file

    // write headers
    this.stream.write( `"File ID","Bytes","Disk Space","Creation","Modify","Last Access","Relitive Path","Path","URL"\r\n`);
    this.streamD.write(`"Directory"\r\n`);
    this.streamL.write(`"Links"\r\n`);
    this.streamH.write(`"Directory"\r\n`);

    // creat manifest files
    await app.fsp.mkdir(directoryRead, { recursive: true })       // create directory if it does not exist
    this.getAllFiles(   directoryRead); // local dirtory to generate manifest fils
    directoryRead

    // close the streams
    this.stream.end( );
    this.streamD.end();
    this.streamL.end();
    this.streamH.end();
  }


getAllFiles(  //  sync - server-side    // recursice - find all files in all subdirectories
   directoryRead                  // path to local client machine to directory being synced
  ,childOfHiddenDirectory = false
  ) {
  const files = app.fs.readdirSync(directoryRead);

  files.forEach((file) => {
    const dirFile = `${directoryRead}/${file}`;
    const stat = app.fs.statSync(dirFile);  // should this be converted to a an async version?

    // there are probabliy more cases than this
    if (stat.isSymbolicLink()) {
      // not sure what todo about this
      this.totalLinks++;
      this.streamL.write(`"${dirFile}"\r\n`);
    }
    
    if (stat.isDirectory()) {
      // create csv of directorys
      if (file[0]==='.' || childOfHiddenDirectory) {
        // hidden directory
        this.totalHidden++;
        this.streamH.write(`"${dirFile}"\r\n`);
        this.getAllFiles(dirFile, true );   // recursice
      } else {
        // not hidden directory
        this.streamD.write(`"${dirFile}"\r\n`);
        this.totalDir ++;
        this.getAllFiles(dirFile,  childOfHiddenDirectory);   // recursice
      }
    } else if (file[0]==='.' || childOfHiddenDirectory) {
      // hidden file or childOfHiddenDirectory
      this.totalHidden++;
      this.streamH.write(`"${dirFile}"\r\n`);
    } else {
      // assume a regulare file
      // inode,size, disk size,"last access date", creation date", "path with file name"
      let url="do to";
      let dirFileRel = dirFile.slice( this.directoryRead.length);
      this.stream.write(`${stat.ino},${stat.size},${stat.blksize*stat.blocks},"${stat.birthtime.toUTCString()}","${stat.mtime.toUTCString()}","${stat.atime.toUTCString()}","${dirFileRel}","${dirFile}","${url}"\r\n`);
      this.totalFiles++;
    }
  });
}


} //  sync - server-side    //////// end of class
