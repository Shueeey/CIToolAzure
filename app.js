var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config(); // loads .env if running locally
const sql = require('mssql');

var indexRouter = require('./routes');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

app.get('/api/ideas', async (req, res) => {
  const config = {
    server: process.env.AZURE_SQL_SERVER,
    port: parseInt(process.env.AZURE_SQL_PORT),
    database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USERNAME,
    password: process.env.AZURE_SQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  };

  try {
    await sql.connect(config);
    const result = await sql.query('SELECT * FROM YourTableName'); // replace with your actual table
    res.json(result.recordset);
  } catch (err) {
    console.error('Database fetch failed:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    await sql.close();
  }
});
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
