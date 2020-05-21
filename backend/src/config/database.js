require('dotenv/config');

module.exports = {
  dialect: 'postgres',
  host: process.env.DB_HOST,
  username: process.env.USER,
  password: process.env.PASS,
  database: process.env.NAME,
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true,
  },
};
