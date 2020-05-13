/* eslint-disable prettier/prettier */
import Sequelize from 'sequelize';

import User from '../app/models/User';
import File from '../app/models/File';

import databaseConfig from '../config/database';

const models = [User, File];

class Database {
  constructor() {
    this.init();
  }

  init() {
    this.connection = new Sequelize(databaseConfig);

    // eslint-disable-next-line prettier/prettier
    models
      .map(model => model.init(this.connection))
      .map(model => model.associate && model.associate(this.connection.models));


  }
}

export default new Database();
