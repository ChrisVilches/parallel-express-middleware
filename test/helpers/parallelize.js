const parallel = require('../../parallel');

async function parallelize(nextResult, resValue) {
  const obj = this._obj;

  const resultMiddleware = parallel(...obj);
  let obtainedNextResult;
  const res = {
    value: 0,
    render: () => {}
  };

  await resultMiddleware(null, res, nextParam => { obtainedNextResult = nextParam; });

  this.assert(
    nextResult == obtainedNextResult,
    `expected middleware to execute next with argument ${nextResult}, but got ${obtainedNextResult}`,
    `expected middleware to not execute next with argument ${nextResult}, but got ${obtainedNextResult}`,
  );

  this.assert(
    res.value == resValue,
    `expected middleware to generate res.value = ${resValue}, but got res.value = ${res.value}`,
    `expected middleware to not generate res.value = ${resValue}, but got res.value = ${res.value}`,
  );  
}

module.exports = parallelize;
