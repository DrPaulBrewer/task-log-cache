/* eslint-env node, mocha */

const assert = require('assert');
require('should');
const taskLogCache = require('../index.js');
const IoRedis = require('ioredis');

const redisServerLocal = {
  host: "localhost",
  port: 6379,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 2000);
    return delay;
  }
};

const ioredis = new IoRedis(redisServerLocal);

after(function(){
  ioredis.disconnect();
});

const specs = [
  {
    ioredis,
    prefix: 'task:',
    index: 'tasks',
    ttl: 30,
    ttlRenewOnWrite: true,
    ttlRenewOnRead: true
  },
  {
    ioredis,
    prefix: 'task:',
    index: 'tasks',
    ttl: 30,
    ttlRenewOnWrite: false,
    ttlRenewOnRead: true
  },
  {
    ioredis,
    prefix: 'task:',
    index: 'tasks',
    ttl: 30,
    ttlRenewOnWrite: true,
    ttlRenewOnRead: false
  },
  {
    ioredis,
    prefix: 'task:',
    index: 'tasks',
    ttl: 30,
    ttlRenewOnWrite: false,
    ttlRenewOnRead: false
  },
  {
    ioredis,
    prefix: 'task:',
    index: 'tasks'
  }
];

async function commonTests(spec){
  let tasklog;
  it('should initialize OK', function(){
    tasklog = taskLogCache(spec);
  });
  it('tasklog.summary() should be {}', async function(){
    const result = await tasklog.summary();
    result.should.deepEqual({});
  });
  it('tasklog.push(1,{task:"start", progress:"0%"}) returns 1', async function(){
    const result = await tasklog.push(1,{task: "start", progress: "0%"});
    result.should.equal(1);
  });
  if (spec.ttl>0){
    it(`ttl for prefix+"1" should be approx ${spec.ttl}`, async function(){
      const ttl = await ioredis.ttl(spec.prefix+'1');
      ttl.should.be.within(spec.ttl-1,spec.ttl+1);
    });
    it('wait 5 sec', function(done){
      setTimeout(done, 5000);
    });
    it(`ttl for prefix+"1" should be approx ${spec.ttl-5}`, async function(){
      const ttl = await ioredis.ttl(spec.prefix+'1');
      ttl.should.be.within(spec.ttl-6,spec.ttl-4);
    });
  }
  it('tasklog.push(1,{task:"start", progress:"100%"}) returns 2',async function(){
    const result = await tasklog.push(1,{task: "start", progress: "100%"});
    result.should.equal(2);
  });
  if (spec.ttl>0){
    let expectedTTL = (spec.ttlRenewOnWrite)? spec.ttl: (spec.ttl-5);
    it(`ttl for prefix+"1" should be approx ${expectedTTL}`, async function(){
      const ttl = await ioredis.ttl(spec.prefix+'1');
      ttl.should.be.within(expectedTTL-1,expectedTTL+1);
    });
  }
  it('tasklog.push(2,{task:"start", progress:"0%"}) returns 1',async function(){
    const result = await tasklog.push(2,{task: "start", progress: "0%"});
    result.should.equal(1);
  });
  it('tasklog.summary() should be {1: 2, 2:1}', async function(){
    const result = await tasklog.summary();
    const expected = {1: 2, 2: 1};
    result.should.deepEqual(expected);
  });
  if (spec.ttl>0){
    it('wait 5 sec', function(done){
      setTimeout(done, 5000);
    });
  }
  it('tasklog.get(1) should be previously written 2 element array', async function(){
    const result = await tasklog.get(1);
    result.should.deepEqual([
      {task: "start", progress: "0%"},
      {task: "start", progress: "100%"}
    ]);
  });
  if (spec.ttl>0){
    let expectedTTL = spec.ttl+[[-10,-5],[0,0]][+spec.ttlRenewOnRead][+spec.ttlRenewOnWrite];
    it(`ttl for prefix+"1" should be approx ${expectedTTL}`, async function(){
      const ttl = await ioredis.ttl(spec.prefix+'1');
      ttl.should.be.within(expectedTTL-1,expectedTTL+1);
    });
  }
  it('tasklog.get(2) should be previously written 1 element array', async function(){
    const result = await tasklog.get(2);
    result.should.deepEqual([
      {task: "start", progress: "0%"}
    ]);
  });
  it('tasklog.delete(1) should succeed', async function(){
    await tasklog.delete(1);
    const getAfterDel = await tasklog.get(1);
    getAfterDel.should.deepEqual([]);
    const summaryAfterDel = await tasklog.summary();
    summaryAfterDel.should.deepEqual({2:1});
  });
  if (spec.ttl>0){
    it(`wait ${spec.ttl} sec`, function(done){
      setTimeout(done, spec.ttl*1000);
    });
    it('tasklog.summary() should be nonempty, zero valued', async function(){
      const result = await tasklog.summary();
      Object.keys(result).length.should.be.above(0);
      assert(Object.values(result).every((v)=>(v===0)), "some list elements exist past expiration");
    });
    it('tasklog.reap() should succeed', async function(){
      await tasklog.reap();
      const all = await tasklog.summary();
      all.should.deepEqual({});
    });
  }
  it('cleanup:  sending FLUSHALL', async function () {
      return await ioredis.flushall();
  });
}

describe('initialize test database: ', function () {
  it('sending FLUSHALL', async function () {
      return await ioredis.flushall();
  });
});

describe('taskLogCache', function(){
  describe('incomplete spec', function(){
      it('should throw error', function(){
        function bad(){
          taskLogCache({
            ioredis
          });
        }
        bad.should.throw();
      });
  });
  specs.forEach((spec,specnumber)=>{
    describe('test spec '+specnumber, function(){
      commonTests(spec);
    });
  });
});
