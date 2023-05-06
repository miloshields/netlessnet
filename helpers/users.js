const crypto = require('crypto');
require('dotenv').config();

async function setUserMode(mongoClient, phoneNumber, mode) {
    const salt = process.env.SALT_VALUE;
    const hash = crypto.createHash('sha512').update(phoneNumber + salt).digest('hex');

    const usersCollection = mongoClient.db('netlessnet').collection('numbers');
    const result = await usersCollection.findOne({ _id: hash });

    if (result === null) {
        await usersCollection.insertOne({ _id: hash, status: mode });
    }
}

async function getUserMode(mongoClient, phoneNumber) {
    const salt = process.env.SALT_VALUE;
    const hash = crypto.createHash('sha512').update(phoneNumber + salt).digest('hex');
  
    const usersCollection = mongoClient.db('netlessnet').collection('numbers');
    const result = await usersCollection.findOne({ _id: hash });
  
    if (result === null) {
      return null;
    } else {
      return result.status;
    }
  }

module.exports = {
    setUserMode,
    getUserMode
}