/*

Would like to store logs of user interactions.   For example save in accounting. should append all user interaction file, or open write and close

2 to 3 times faster to do multiple writes.
12-20 times faster to stream data 

*/

//  serverClass - server-side
class benchmarkClass {

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

  const dur1 = await this.test("1");
  const dur2 = await this.test("2");
  const dur3 = await this.test("3");
  console.log(dur1/dur2);
  console.log(dur1/dur3)
}

async test(testNumber){
  // wait for each write to finish
  const start = new Date();
  const dir = this.dir+"/test"+testNumber;
  await this.verifyPath(dir)

  await this["test"+testNumber](dir);

  const end = new Date();
  const dur = end-start;
  console.log(`test 1 duration=${dur}`);
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
