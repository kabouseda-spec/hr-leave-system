require('dotenv').config();
const db = require('./database');
console.log('✅ Database initialised');
module.exports = db;
