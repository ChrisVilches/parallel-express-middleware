const assert = require('assert');
const parallel = require('../parallel');
const parallelize = require('./helpers/parallelize');
const chai = require('chai');
const expect = chai.expect;

const ARG_ARITY_ERROR = 'All middlewares need to be functions with three arguments (req, res, next).';
const ARG_EMPTY_ERROR = 'Middleware argument list cannot be empty.';

const sleep = async ms => await new Promise(r => setTimeout(r, ms));

const syncMiddleware = nextParam => (_req, res, next) => {
  res.value++;
  if(nextParam){
    next(nextParam);
  } else {
    next();
  }
}

const asyncMiddleware = nextParam => async (req, res, next) => {
  await sleep(100);
  return await syncMiddleware(nextParam)(req, res, next);
}

chai.use(chai => {
  chai.Assertion.addMethod('parallelize', parallelize);
});

describe('parallel', () => {
  it('should throw error when middleware arguments is empty', () => {
    expect(() => { parallel([]); }).to.throw(ARG_EMPTY_ERROR);
    expect(() => { parallel(); }).to.throw(ARG_EMPTY_ERROR);
  });

  it('should throw error when middleware type is incorrect', () => {
    expect(() => { parallel(2); }).to.throw(ARG_ARITY_ERROR);
    expect(() => { parallel(true); }).to.throw(ARG_ARITY_ERROR);
    expect(() => { parallel('string'); }).to.throw(ARG_ARITY_ERROR);
  });

  it('should allow arguments to be passed as either comma separated values or one array', () => {
    const fn = (_res, _req, _next) => {};
    expect(() => { parallel(fn, fn, fn); }).to.not.throw();
    expect(() => { parallel([fn, fn, fn]); }).to.not.throw();
  });

  it('should pass exceptions thrown inside middlewares to the next middleware', async () => {
    const middlewareMock = (_req, _res, _next) => {
      throw new Error('hello world');
    };

    await expect([middlewareMock]).to.parallelize((new Error('hello world')).toString(), 0);
  });

  it('should pass exceptions thrown inside promise/async middlewares to the next middleware', async () => {
    const middlewareMock = (_req, _res, _next) => {
      return new Promise(() => {
        throw new Error('hello world');
      });
    };

    await expect([middlewareMock]).to.parallelize((new Error('hello world')).toString(), 0);
  });

  it('should pass error to next middleware when using a rendering function inside a middleware', async () => {
    const errString = "Function 'render' cannot be used while executing parallel middlewares.";
    const middlewareMock = (_req, res, _next) => {
      res.render('index');
    };

    await expect([middlewareMock]).to.parallelize((new Error(errString)).toString(), 0);
  });

  it('should execute two sync middlewares (without async/await) without error', async () => {
    await expect([syncMiddleware(), syncMiddleware()]).to.parallelize(undefined, 2);
  });

  it('should execute one async and one sync middlewares correctly', async () => {
    await expect([syncMiddleware(), asyncMiddleware()]).to.parallelize(undefined, 2);
  });

  it('should execute two async middlewares without error', async () => {
    await expect([asyncMiddleware(), asyncMiddleware()]).to.parallelize(undefined, 2);
  });

  it('should work with more than two middlewares', async () => {
    await expect([asyncMiddleware(), syncMiddleware(), asyncMiddleware()]).to.parallelize(undefined, 3);
  });

  it('should need the use of await when using two async middlewares', () => {
    const resultMiddleware = parallel(asyncMiddleware(), asyncMiddleware());
    let nextResult;
    const res = { value: 0 };
    resultMiddleware(null, res, nextParam => { nextResult = nextParam; });
    assert.strictEqual(nextResult, undefined);
    assert.strictEqual(res.value, 0);
  });

  it('executes next with parameter when at least one middleware executes it, and cancels all other middlewares (if they have not executed yet)', async () => {
    // It rejects the promise as soon as it encounters a next(PARAM), therefore
    // the Promise.all will be rejected before the async one executes (sync one executes right away).
    await expect([asyncMiddleware(), asyncMiddleware(), syncMiddleware('error')]).to.parallelize('error', 1);
  });

  it('executes next with parameter when at least one middleware executes it', async () => {
    // Since res.value is always increased by +1 (even when an error is used in next()),
    // it will execute both res.value++ before rejecting the Promise.all.
    await expect([asyncMiddleware('error'), syncMiddleware()]).to.parallelize('error', 2);
  });

  it('executes next with parameter that was first used', async () => {
    // Sync middleware executes next() first.
    // Async middleware does not execute it's res.value++ because the promise is rejected before
    // that can happen.
    await expect([asyncMiddleware('async'), syncMiddleware('sync')]).to.parallelize('sync', 1);
  });
});
