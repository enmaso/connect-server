require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const session = require('express-session')
const redis = require('redis')
const connectRedis = require('connect-redis')
const morgan = require('morgan')

const routes = require('./routes')

// Application setup
const app = express()
const RedisStore = connectRedis(session)
const redisClient = redis.createClient()

// Middleware
app.use(morgan('dev'))
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

// Redis session
let sessionOpts = {
  secret: process.env.REDIS_SECRET,
  store: new RedisStore({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    client: redisClient
  }),
  saveUninitialized: true,
  resave: true
}
app.use(session(sessionOpts))

// Mongo connection
let mongoOpts = {
  poolSize: Number(process.env.MONGO_POOLSIZE) || 4,
  useMongoClient: true
}
let mongoUri = `mongodb://${process.env.MONGO_HOST}/${process.env.MONGO_DB}`
mongoose.connect(mongoUri, mongoOpts)

mongoose.Promise = global.Promise

// Service routes
app.use('/connect', routes)

// Server status route
app.get('/status', (req, res) => {
  res.status(200).json({
    'message': 'OK'
  })
})

// If Route not found, 404
app.all('*', (req, res) => {
  res.status(404).json({
    'error': 'Route not found'
  })
})

// Run service
app.listen(process.env.PORT, () => {
  console.log(`[${process.env.NODE_ENV}] Connect-Server ready on port ${process.env.PORT}`)
})
