require('dotenv').config()
const express = require('express')
const AWS = require('aws-sdk')
const BoxSDK = require('box-node-sdk')
const request = require('request')

const File = require('../lib/file')
const Service = require('../lib/service')

const router = express.Router()
const BOX_FOLDERS_URL = 'https://api.box.com/2.0/folders/0/items'
const BOX_FILES_URL = 'https://api.box.com/2.0/files/'
const params = {}

const sqs = new AWS.SQS({
  apiversion: '2012-11-05',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
})

router.post('/', (req, res) => {
  params.userId = req.session.passport.user

  // Find service object
  Service.findOne({
    provider: 'box',
    userId: params.userId
  })
  .exec()
  .then(service => {
    if (service === null) {
      console.error('Box service not found')
      res.status(404).json({
        'error': 'Box service not found'
      })
    } else {
      params.accessToken = service.accessToken
      params.refreshToken = service.refreshToken
      params.serviceId = service._id.toString()

      // Load Box SDK and grab file list
      let sdk = new BoxSDK({
        clientID: process.env.BOX_CLIENT_ID,
        clientSecret: process.env.BOX_CLIENT_SECRET
      })

      // Ensure accessToken is valid
      sdk.getTokensRefreshGrant(params.refreshToken, (err, tokens) => {
        if (err) {
          console.error(err)
          res.status(500).json({
            'error': err
          })
        } else {
          service.accessToken = params.accessToken = tokens.accessToken
          service.refreshToken = params.refreshToken = tokens.refreshToken
          service.save(err => {
            if (err) console.error(err)
          })
          requestBoxFiles(res)
        }
      })
    }
  })
  .catch(err => {
    console.error(err)
    return res.status(500).json({
      'error': err
    })
  })
})

function requestBoxFiles (res) {
  request({
    url: BOX_FOLDERS_URL,
    qs: {
      limit: 10000,
      offset: 0
    },
    headers: {
      'Authorization': 'Bearer ' + params.accessToken
    }
  }, function (err, response, list) {
    if (err) {
      console.error(err)
      res.status(500).json({
        'error': err
      })
    } else if (response.statusCode !== 200) {
      console.error('Box API returned a', response.statusCode)
      res.status(response.statusCode).json({
        'error': response.statusCode
      })
    } else {
      let dataset = JSON.parse(list)
      let files = []
      for (let i = 0; i < dataset.entries.length; i++) {
        files.push({
          userId: params.userId,
          serviceId: params.serviceId,
          name: dataset.entries[i].name,
          source: dataset.entries[i],
          downloadUrl: BOX_FILES_URL + dataset.entries[i].id + '/content'
        })
      }
      File.collection.insert(files, (err, docs) => {
        if (err) {
          console.error(err)
          res.status(500).json({
            'error': err
          })
        } else {
          for (let i = 0; i < docs.ops.length; i++) {
            let messageParams = {
              MessageBody: docs.ops[i]._id.toString(),
              QueueUrl: process.env.AWS_QUEUE_URL
            }
            sqs.sendMessage(messageParams, (err, data) => {
              if (err) {
                console.error(err)
              } else {
                console.log('Sent to queue', data.MessageId)
              }
            })
          }
          res.status(200).json({
            'files': docs
          })
        }
      })
    }
  })
}

module.exports = router
