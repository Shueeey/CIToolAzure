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

// Connection pool for better performance
let pool = null;

// Initialize connection pool
async function initializePool() {
  try {
    if (!pool) {
      pool = await sql.connect(config);
      console.log('Database connection pool initialized');
    }
    return pool;
  } catch (err) {
    console.error('Failed to initialize database pool:', err);
    throw err;
  }
}

/* GET home page with database status */
router.get('/', async function(req, res, next) {
  let dbStatus = {
    connected: false,
    error: null,
    data: [],
    timestamp: new Date().toISOString()
  };

  try {
    await initializePool();

    // Get top 5 most recent ideas with key columns
    const result = await pool.request().query(`
      SELECT TOP 5 
        ID,
        Title,
        Date,
        Idea,
        SubmittedBy,
        Team,
        Priority_Level,
        State,
        Lead,
        LeadOwner,
        Operational,
        Closed,
        Closed_Date,
        Notes,
        Created_By,
        Item_Type
      FROM IdeasList 
      ORDER BY 
        CASE WHEN Date IS NOT NULL THEN Date ELSE '1900-01-01' END DESC,
        ID DESC
    `);

    dbStatus.connected = true;
    dbStatus.data = result.recordset;
    dbStatus.recordCount = result.recordset.length;

  } catch (err) {
    console.error('Database connection error:', err);
    dbStatus.error = err.message;
  }

  res.render('dashboard', {
    title: 'SSC Continuous Improvement Dashboard',
    dbStatus: dbStatus
  });
});

/* API endpoint for database status and schema info */
router.get('/api/db-status', async function(req, res, next) {
  let dbStatus = {
    connected: false,
    error: null,
    data: [],
    schema: {},
    timestamp: new Date().toISOString()
  };

  try {
    await initializePool();

    // Get total record count
    const countResult = await pool.request().query('SELECT COUNT(*) as totalRecords FROM IdeasList');

    // Get sample data with main columns
    const sampleData = await pool.request().query(`
      SELECT TOP 3 
        ID, 
        Title, 
        State, 
        Team,
        Priority_Level,
        SubmittedBy,
        Date,
        Lead,
        Operational,
        Closed
      FROM IdeasList 
      ORDER BY 
        CASE WHEN Date IS NOT NULL THEN Date ELSE '1900-01-01' END DESC
    `);

    // Get column information from database schema
    const schemaResult = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'IdeasList'
      ORDER BY ORDINAL_POSITION
    `);

    dbStatus.connected = true;
    dbStatus.totalRecords = countResult.recordset[0].totalRecords;
    dbStatus.sampleData = sampleData.recordset;
    dbStatus.schema = schemaResult.recordset;

  } catch (err) {
    console.error('Database connection error:', err);
    dbStatus.error = err.message;
  }

  res.json(dbStatus);
});

/* API endpoint to get all ideas data with full schema */
router.get('/api/ideas', async function(req, res, next) {
  try {
    await initializePool();

    const result = await pool.request().query(`
      SELECT 
        ID,
        Title,
        Date,
        Idea,
        SubmittedBy,
        New,
        Team,
        Prioritised_for_Review,
        Priority_Level,
        Local_C_I_SSC_C_I,
        State,
        Lead,
        LeadOwner,
        Operational,
        Closed,
        Closed_Date,
        Notes,
        PowerAppsId,
        Attachment,
        isTop6,
        Proposed_Solution,
        Created_By,
        Item_Type,
        Path
      FROM IdeasList 
      ORDER BY 
        CASE WHEN Date IS NOT NULL THEN Date ELSE '1900-01-01' END DESC,
        ID DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/* API endpoint to get ideas with filtering and pagination */
router.get('/api/ideas/filtered', async function(req, res, next) {
  try {
    await initializePool();

    const {
      team,
      state,
      priority,
      operational,
      closed,
      limit = 50,
      offset = 0,
      sortBy = 'Date',
      sortOrder = 'DESC'
    } = req.query;

    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    // Add filters dynamically
    if (team) {
      whereClause += ' AND Team = @team';
      request.input('team', sql.NVarChar, team);
    }

    if (state) {
      whereClause += ' AND State = @state';
      request.input('state', sql.NVarChar, state);
    }

    if (priority) {
      whereClause += ' AND Priority_Level = @priority';
      request.input('priority', sql.NVarChar, priority);
    }

    if (operational !== undefined) {
      whereClause += ' AND Operational = @operational';
      request.input('operational', sql.Bit, operational === 'true' ? 1 : 0);
    }

    if (closed !== undefined) {
      whereClause += ' AND Closed = @closed';
      request.input('closed', sql.Bit, closed === 'true' ? 1 : 0);
    }

    // Validate sortBy column
    const allowedSortColumns = ['ID', 'Date', 'Title', 'State', 'Priority_Level', 'Team', 'SubmittedBy'];
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'Date';
    const validSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    request.input('limit', sql.Int, parseInt(limit));
    request.input('offset', sql.Int, parseInt(offset));

    const query = `
      SELECT 
        ID, Title, Date, Idea, SubmittedBy, New, Team, 
        Prioritised_for_Review, Priority_Level, Local_C_I_SSC_C_I, State, 
        Lead, LeadOwner, Operational, Closed, Closed_Date, Notes,
        PowerAppsId, Attachment, isTop6, Proposed_Solution, Created_By, Item_Type, Path
      FROM IdeasList 
      ${whereClause}
      ORDER BY 
        CASE WHEN ${validSortBy} IS NOT NULL THEN ${validSortBy} ELSE '1900-01-01' END ${validSortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await request.query(query);

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount FROM IdeasList ${whereClause}`;
    const countResult = await pool.request().query(countQuery);

    res.json({
      success: true,
      data: result.recordset,
      count: result.recordset.length,
      totalCount: countResult.recordset[0].totalCount,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + result.recordset.length) < countResult.recordset[0].totalCount
      },
      filters: { team, state, priority, operational, closed },
      sorting: { sortBy: validSortBy, sortOrder: validSortOrder },
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/create-idea', function(req, res, next) {
  res.render('create-idea'); // This will render views/create-idea.ejs
});

router.get('/dashboard', function(req, res, next) {
  res.render('dashboard'); // This will render views/dashboard.ejs
});

router.get('/report', function(req, res, next) {
  res.render('report'); // This will render views/report.ejs
});

router.get('/index', function(req, res, next) {
  res.render('index'); // This will render views/index.ejs
});

/* API endpoint to get unique values for filtering */
router.get('/api/filter-options', async function(req, res, next) {
  try {
    await initializePool();

    const queries = {
      teams: "SELECT DISTINCT Team FROM IdeasList WHERE Team IS NOT NULL AND Team != '' ORDER BY Team",
      states: "SELECT DISTINCT State FROM IdeasList WHERE State IS NOT NULL AND State != '' ORDER BY State",
      priorities: "SELECT DISTINCT Priority_Level FROM IdeasList WHERE Priority_Level IS NOT NULL AND Priority_Level != '' ORDER BY Priority_Level",
      leads: "SELECT DISTINCT Lead FROM IdeasList WHERE Lead IS NOT NULL AND Lead != '' ORDER BY Lead",
      itemTypes: "SELECT DISTINCT Item_Type FROM IdeasList WHERE Item_Type IS NOT NULL AND Item_Type != '' ORDER BY Item_Type"
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await pool.request().query(query);
      results[key] = result.recordset.map(row => Object.values(row)[0]);
    }

    res.json({
      success: true,
      filterOptions: results,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Database query error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database connection pool...');
  if (pool) {
    await pool.close();
  }
  process.exit(0);
});

module.exports = router;