const crypto = require('crypto');
require('dotenv').config();

async function registerUser(phoneNumber, mongoClient) {
    const salt = process.env.SALT_VALUE;
    const hash = crypto.createHash('sha512').update(phoneNumber + salt).digest('hex');

    const usersCollection = mongoClient.db('netlessnet').collection('numbers');
    const result = await usersCollection.findOne({ _id: hash });

    if (result === null) {
        await usersCollection.insertOne({ _id: hash, status: 'registered' });
    }
}

async function checkIfUserExists(phoneNumber, mongoClient) {
    const salt = process.env.SALT_VALUE;
    const hash = crypto.createHash('sha512').update(phoneNumber + salt).digest('hex');

    const usersCollection = mongoClient.db('netlessnet').collection('numbers');
    const result = await usersCollection.findOne({ _id: hash});

    return result !== null;
}

module.exports = {
    checkIfUserExists,
    registerUser
}