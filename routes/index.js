var express = require('express');
var router = express.Router();
const sql = require('mssql');

// Database configuration
const config = {
  server: process.env.AZURE_SQL_SERVER,
  port: parseInt(process.env.AZURE_SQL_PORT),
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USERNAME,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

/* GET home page with database status */
router.get('/', async function(req, res, next) {
  let dbStatus = {
    connected: false,
    error: null,
    data: [],
    timestamp: new Date().toISOString()
  };

  try {
    // Test database connection
    const pool = await sql.connect(config);
    const result = await sql.query('SELECT TOP 5 * FROM IdeasList ORDER BY ID DESC');

    dbStatus.connected = true;
    dbStatus.data = result.recordset;
    dbStatus.recordCount = result.recordset.length;

    await pool.close();
  } catch (err) {
    console.error('Database connection error:', err);
    dbStatus.error = err.message;
  }

  res.render('index', {
    title: 'SSC Continuous Improvement Dashboard',
    dbStatus: dbStatus
  });
});

/* API endpoint for database status */
router.get('/api/db-status', async function(req, res, next) {
  let dbStatus = {
    connected: false,
    error: null,
    data: [],
    timestamp: new Date().toISOString()
  };

  try {
    const pool = await sql.connect(config);
    const result = await sql.query('SELECT COUNT(*) as totalRecords FROM IdeasList');
    const sampleData = await sql.query('SELECT TOP 3 ID, Title, Status, Domain FROM IdeasList ORDER BY ID DESC');

    dbStatus.connected = true;
    dbStatus.totalRecords = result.recordset[0].totalRecords;
    dbStatus.sampleData = sampleData.recordset;

    await pool.close();
  } catch (err) {
    console.error('Database connection error:', err);
    dbStatus.error = err.message;
  }

  res.json(dbStatus);
});

/* API endpoint to get all ideas data */
router.get('/api/ideas', async function(req, res, next) {
  try {
    const pool = await sql.connect(config);
    const result = await sql.query('SELECT * FROM IdeasList ORDER BY ID DESC');

    await pool.close();
    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length
    });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
