# task-log-cache

[![Build Status](https://travis-ci.org/DrPaulBrewer/task-log-cache.svg?branch=master)](https://travis-ci.org/DrPaulBrewer/task-log-cache)
[![Coverage Status](https://coveralls.io/repos/github/DrPaulBrewer/task-log-cache/badge.svg?branch=master)](https://coveralls.io/github/DrPaulBrewer/task-log-cache?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/DrPaulBrewer/task-log-cache.svg)](https://greenkeeper.io/)

Redis-based task status log/cache

## Installation

```
npm i ioredis -S
npm i task-log-cache -S
```

## Dependencies

Developers using this library must pass a configured `npm:ioredis` client on initialization.  

`npm:@hapi/joi` is used for initial validation.

## Initialization

Below is a sample configuration to:

```
const IoRedis = require('ioredis');
const taskStatusCache = require('task-status-cache');
const redisServerLocal = {
  host: "localhost",
  port: 6379,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 2000);
    return delay;
  }
};
const ioredis = new IoRedis(redisServerLocal);
const tasklogger = taskStatusCache({
    ioredis,
    prefix: 'task:',
    index: 'tasks',
    ttl: 3600*24*3, // keep 3 days
    ttlRenewOnWrite: true,
    ttlRenewOnRead: false
});
```

## Usage

```
await tasklogger.push(key, item);
await tasklogger.summary()
await tasklogger.get(key, ifrom, ito);
await tasklogger.delete(key)
await tasklogger.reap()
```

## Tests

To test:

First, spin up a redis database on localhost using docker

```
 docker run -v /tmp/data:/data \
    --name "red" \
    -d \
    -p 127.0.0.1:6379:6379 \
    redis redis-server --appendonly yes
```

Warning:  Testing will FLUSHALL and DELETES THE ENTIRE DATABSE on localhost.  

```
npm test
```

After running npm test, you may want to delete the redis docker container.

```
docker kill red
docker rm red
```

### Copyright

Copyright 2019 Paul Brewer, Economic and Financial Technology Consulting LLC

### License

The MIT license

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
