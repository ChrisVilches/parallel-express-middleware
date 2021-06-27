/**
 * This module exports a single function called 'parallel' which can be used as:
 * parallel(middleware1, middleware2, middleware3)
 *
 * It will execute the middlewares in parallel, in random order, and continue executing
 * the next middleware when all have finished.
 *
 * All errors are passed to the next middleware using next(err), including runtime exceptions
 * will be handled this way.
 *
 * Only middlewares that don't depend on each other should be used. Don't use middlewares that
 * modify the same data in res.locals if the order of execution is important, or if one middleware
 * needs data created by another middleware being executed in parallel.
 *
 * TODO: This should be configurable.
 * Rendering functions (e.g. render, json) are disabled during execution, because rendering
 * something while another middleware is executing may be a user made bug, so this is
 * avoided by raising an exception.
 *
 * TODO: Test (manually or otherwise) some other cases where it could fail.
 *
 * TODO: Deploy to NPM, to avoid having it here (and to share it).
 *
 */
const R = require('ramda');

const DISABLED_RENDER_FUNCTIONS = true;
const RENDER_FUNCTIONS = Object.freeze([
  'render',
  'json',
  'jsonp',
  'redirect',
  'send',
  'sendFile',
  'sendStatus'
]);

const isAllowedMiddleware = middleware => {
  if(typeof middleware != 'function') return false;
  return middleware.length == 3; // Only allow middlewares having next parameter. 
}

const validateMiddlewares = middlewares => {
  if(middlewares.length == 0) throw new Error('Middleware argument list cannot be empty.');
  middlewares.forEach(m => {
    if(!isAllowedMiddleware(m)) throw new Error('All middlewares need to be functions with three arguments (req, res, next).');
  });
}

const disableFunction = functionName => () => {
  throw new Error(`Function '${functionName}' cannot be used while executing parallel middlewares.`);
}

const disableRenderFunctions = res => {
  const disabledFunctions = {};
  RENDER_FUNCTIONS.forEach(fn => {
    disabledFunctions[fn] = res[fn];
    res[fn] = disableFunction(fn);
  });
  return disabledFunctions;
}

const isPromise = R.is(Promise);

const patchedNext = (resolve, reject) => (...args) => {
  if(args.length > 0) return reject(args);
  resolve();
}

const middlewareToPromise = (middleware, req, res) => {
  return (new Promise((resolve, reject) => {
    const result = middleware(req, res, patchedNext(resolve, reject));

    // In case the result of the middleware is a promise, catch the error, and use it
    // to reject the outer promise.
    if(isPromise(result)) result.catch(reject);
  }));
}

const handleErrorsNext = next => err => {
  if(!err) throw new Error('Only use this function when next is executed with errors.');

  // Since errors can be thrown via runtime exception, or via executing next(err),
  // sometimes the error object is an array.
  if(R.is(Array, err)) err = err[0];
  next(err);
}

const parallel = (...middlewares) => {
  // Allow argument to be passed as comma separated values (m1, m2, m3) or as one array ([m1, m2, m3]).
  if(middlewares.length == 1 && R.is(Array, middlewares[0])) middlewares = middlewares[0];
  validateMiddlewares(middlewares);

  return (req, res, next) => {
    const disabledFunctions = DISABLED_RENDER_FUNCTIONS ? disableRenderFunctions(res) : {};
    const promises = middlewares.map(m => middlewareToPromise(m, req, res));

    // Add functions again.
    Object.assign(res, disabledFunctions);

    return Promise.all(promises)
                  .then(() => next())
                  .catch(handleErrorsNext(next));
  };
}

module.exports = parallel;
