module.exports = class sync {

/*

sync allow working offline on local computer and syncing changed files with other computers. It is simialr to google drive

Bugs-
  create /syc/{new machine folder}
*/


constructor () {  //  sync - server-side
   // nothing to do yet
   this.x = 0;
}


async manifest( //  sync - server-side
   msg          // null for now
  ,request      // HTTPS request
  ,response     // HTTPS response
) { 
  try {
    // init counters
    this.totalDir   = 0;
    this.totalFiles = 0;
    this.totalLinks = 0;

    // create files in local user space
    const dir =  app.sessions.getUserDir(request);
    this.stream   = app.fs.createWriteStream( `${dir}/sync/${app.config.machine}/1-manifest.csv`  , {flags: 'a'});
    this.streamD  = app.fs.createWriteStream( `${dir}/sync/${app.config.machine}/2-dir.csv`       , {flags: 'a'});
    this.streamL  = app.fs.createWriteStream( `${dir}/sync/${app.config.machine}/3-links.csv`     , {flags: 'a'});
  
    // write header
    this.stream.write(`"File ID","Bytes","Disk Space","Last Access","Creation","Path"\r\n`);

    this.getAllFiles("/Users/davidbolt/1-topics"); // hard code for now
    //console.log(`${this.totalDir} + ${this.totalFiles} = ${this.totalDir + this.totalFiles}`);
   // console.log(`total links = ${this.totalLinks}`);
  } catch(e) {
    console.log(e);   // need to be logged
  }
}


getAllFiles(  //  sync - server-side
  dirPath  // path to local client machine to directory being synced
  ) {
  const files = app.fs.readdirSync(dirPath);

  files.forEach((file) => {
    const dirFile = `${dirPath}/${file}`;
    const stat = app.fs.statSync(dirFile);

    if (stat.isSymbolicLink()) {
      this.totalLinks++;
      this.streamL.write(`"${dirFile}"\r\n`);
    }

    if (stat.isDirectory()) {
      // create csv of direcotorys
      this.streamD.write(`"${dirFile}"\r\n`);
      this.totalDir ++;
      this.getAllFiles(dirFile);
    } else {
      // assume create csv of files
      // inode,size, disk size,"last access date", creation date", "path with file name"
      this.stream.write(`${stat.ino},${stat.size},${stat.blksize*stat.blocks},"${stat.atime.toUTCString()}","${stat.birthtime.toUTCString()}","${dirFile}"\r\n`);
      this.totalFiles++;
    }
  });
}


} //  sync - server-side    //////// end of class
