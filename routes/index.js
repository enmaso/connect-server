const express = require('express')
const router = express.Router()

const box = require('./box')
const dropbox = require('./dropbox')
const google = require('./google')
const microsoft = require('./microsoft')
const twitter = require('./twitter')
const linkedin = require('./linkedin')

// Middleware ensure session state
router.use((req, res, next) => {
  if (req.session.passport) {
    next()
  } else {
    return res.status(401).json({
      'error': 'Unauthorized'
    })
  }
})

// Route Authorize Box Service
router.use('/box', box)

// Route Authorize Dropbox Service
router.use('/dropbox', dropbox)

// Route Authorize Google Service
router.use('/google', google)

// Route Authorize LinkedIn Service
router.use('/linkedin', linkedin)

// Route Authorize Microsoft Service
router.use('/microsoft', microsoft)

// Route Authorize Twitter Service
router.use('/twitter', twitter)

module.exports = router
