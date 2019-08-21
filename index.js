const Joi = require('@hapi/joi');

const schema = Joi.object().keys({
  ioredis: Joi.object().required().unknown(),
  prefix: Joi.string().required(),
  index: Joi.string().required(),
  ttl: Joi.number().min(0),
  ttlRenewOnWrite: Joi.boolean(),
  ttlRenewOnRead: Joi.boolean()
});

class TaskLogCache {
  constructor(options){
    Object.assign(this,options);
  }

  async summary(){
    const categories = await this.ioredis.smembers(this.index);
    if (categories.length===0) return {};
    let transaction = this.ioredis.multi();
    categories.forEach((k)=>{transaction = transaction.llen(this.prefix+k);});
    const counts = await transaction.exec();
    const result = {};
    categories.forEach((k,i)=>{result[k]=counts[i][1];});
    return result;
  }

  async push(k, status){
    const listKey = this.prefix+k;
    const stringified = (typeof(status)==="string")? status: JSON.stringify(status);
    const firstTransaction = (
      this
      .ioredis
      .multi()
      .sadd(this.index,k)
      .rpush(listKey,stringified)
    );
    const firstResult = await firstTransaction.exec();
    if (this.ttl>0){
      const additionalCategory  = firstResult[0][1];
      if (additionalCategory || this.ttlRenewOnWrite) {
          await this.ioredis.expire(listKey, this.ttl);
      }
    }
    return firstResult[1][1]; // new length of status list
  }

  async get(key, ifrom=0, ito=-1){
    const listKey = this.prefix+key;
    if ((this.ttl>0) && (this.ttlRenewOnRead)){
      await this.ioredis.expire(listKey,this.ttl);
    }
    const result = await this.ioredis.lrange(listKey,ifrom,ito);
    return result.map((s)=>((s.startsWith("{"))?(JSON.parse(s)):s));
  }

  async delete(key){
    const listKey = this.prefix+key;
    await(
      this
      .ioredis
      .multi()
      .srem(this.index,key)
      .del(listKey)
      .exec()
    );
  }

  async reap(){
    const all = await this.summary();
    const emptyList = Object.keys(all).filter((k)=>(all[k]===0));
    if (emptyList.length>0){
      let transaction = (
        this
        .ioredis
        .multi()
        .srem(this.index,emptyList)
        .del(emptyList.map((k)=>(this.prefix+k)))
      );
      await transaction.exec();
    }
  }
}

module.exports = function (options) {
  const { error, value } = Joi.validate(options,schema);
  if (error!==null) throw new Error("TaskLogCache initialization error: "+error);
  return new TaskLogCache(value);
};
