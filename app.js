var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var sql = require('mssql'); // NEW
require('dotenv').config(); // optional, for local development

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
app.use('/users', usersRouter);

// ✅ NEW: Test DB connection route
app.get('/test-db', async (req, res) => {
  const config = {
    server: process.env.AZURE_SQL_SERVER,         // e.g., 'continuousimprovementideas.database.windows.net'
    port: parseInt(process.env.AZURE_SQL_PORT),   // usually 1433
    database: process.env.AZURE_SQL_DATABASE,     // e.g., 'ContinuousImprovementIdeas'
    user: process.env.AZURE_SQL_USERNAME,         // e.g., 'CloudSAffdb68dc'
    password: process.env.AZURE_SQL_PASSWORD,     // stored securely
    options: {
      encrypt: true,                              // Required for Azure
      trustServerCertificate: false
    }
  };

  try {
    await sql.connect(config);
    const result = await sql.query('SELECT * FROM YourTableName'); // Replace with your actual table name
    res.json(result.recordset); // return rows as JSON
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    sql.close();
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
