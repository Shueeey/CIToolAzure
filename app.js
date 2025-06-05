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
app.use('/users', usersRouter);

// ✅ DB connection check (prints to console on startup)
async function testDbConnection() {
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
    const result = await sql.query('SELECT TOP 3 * FROM YourTableName'); // replace with your actual table name
    console.log('✅ Connected to Azure SQL. Sample data:');
    console.table(result.recordset);
  } catch (err) {
    console.error('❌ DB connection failed:', err.message);
  } finally {
    await sql.close();
  }
}

testDbConnection(); // <-- Called once when server starts

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
