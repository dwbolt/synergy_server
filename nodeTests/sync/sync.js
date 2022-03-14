/*

sync is a way to sync multiple computers



*/

//  serverClass - server-side
class sync {

//  serverClass - server-side
constructor (s_configDir) {
  // native nodejs modules
  this.fsp      = require('fs/promises'); // access local file system
  this.fs       = require('fs')         ; // access local file system
  this.dir      = "testData";

  this.itterations =1000;
}


async main() {
  await this.verifyPath(this.dir );

  const dur1 = await this.test("1","await for each file creation");
  console.log("");

  const dur2 = await this.test("2","start creation process for all files, await completion of all");
  console.log(dur1/dur2);
  console.log("");

  const dur3 = await this.test("3","only create one file, use file sream append");
  console.log(dur1/dur3)
  console.log("");
}

async test(testNumber, msg){
  // wait for each write to finish
  const start = new Date();
  const dir = this.dir+"/test"+testNumber;
  await this.verifyPath(dir)

  await this["test"+testNumber](dir);

  const end = new Date();
  const dur = end-start;
  console.log(`duration=${dur} ${msg}`);
  return dur;
}

async test1(dir){
  for (let i=0;  i< this.itterations; i++) {
     await this.fsp.writeFile( dir + `/test${i}.txt`, "hello world");
  }
}


async test2(dir){
  const p=[];
  for (let i=0;  i< this.itterations; i++) {
     p.push( this.fsp.writeFile( dir + `/test${i}.txt`, "hello world") );
  }
  await Promise.all(p);
}


async test3(dir) {
  const stream = app.fs.createWriteStream(dir + "/test.txt"   , {flags: 'a'});
  for (let i=0;  i< this.itterations; i++) {
     stream.write("hello world "+i+"\n");
  }
}


async verifyPath(
  path  // string of path to create/verify
) {
  try {
    await this.fsp.mkdir(path, {recursive: true});
  } catch (e) {
    app.logs.error(`erverClass.verifyPath error = ${e}`);
  }
}


//  serverClass - server-side
} //////// end of class

const app = new benchmarkClass();
app.main();
