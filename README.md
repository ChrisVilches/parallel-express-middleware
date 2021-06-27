# Parallel Express Middleware

## Install

```bash
npm install parallel-express-middleware --save
```

## Usage

```javascript
const parallel = require('parallel-express-middleware');

const getUsers = async (req, res, next) => {
  res.locals.users = await User.all();
  next();
}

const getArticles = async (req, res, next) => {
  res.locals.articles = await Article.all();
  next();
}

router.get('/', parallel(getUsers, getArticles), (req, res) => {
  // Success
  res.render('index');
}, (err, req, res, next) => {
  // Error happened
  res.send('Error!');
});
```
