'use strict';

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const auth = require("./auth.js");
const app = express();
app.use(cors())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());


const MongoClient = require("mongodb").MongoClient;
const cfenv = require('cfenv');
const appenv = cfenv.getAppEnv();
const services = appenv.services;

// the || allows for local development
const mongodb_services = services["compose-for-mongodb"] || auth["compose-for-mongodb"];
// const mongodb_services = services["compose-for-mongodb"];
const credentials = mongodb_services[0].credentials;
var ca = [new Buffer(credentials.ca_certificate_base64, 'base64')];
var troyism;


const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

// MongoClient.connect('mongodb://localhost/troyism', 
MongoClient.connect(credentials.uri, {
      mongos: {
          ssl: true,
          sslValidate: true,
          sslCA: ca,
          poolSize: 1,
          reconnectTries: 1
      }
    }, 
  function(err, db) {
    if (err) {
      console.log(err);
    } else {
      console.log('database connected')
      troyism = db.collection('isms')
      troyism.createIndex({'ism': 'text'})
    }
  }
);

//POST
app.post('/slack', (req, res, next)=>{
  var b = req.body
  if(b.token == auth.token && b.channel_id == auth.channel_id){
    var text = b.text
    router(res, text)
  } else {
    res.end("You have the wrong credentials. Contact @j.skinner to get credentials.")
  }
})
app.post('/', (req, res, next)=>{
  var data
  troyism.find({}, (err, data)=>{
    data.toArray().then((e,d)=>{ 
      res.send(JSON.parse(d)) 
    })
  })
  
})
app.get('/', (req, res, next)=>{
  res.send("Hello World. From Troyism")
})

app.listen(port)
console.log('running on '+ port);


/*
~~~~~~~~~~~~~~~~~~~~~~~
ROUTER
~~~~~~~~~~~~~~~~~~~~~~~
*/


function router(res, text){
  var args = {
    channel: true,
    name: 'Troyism',
  }

  //list
  if(text == 'list'){
    var cursor = troyism.find({}).sort({id:1})
    cursor.toArray().then((d)=>{
        args.text = formatText(d)
        res.send(formatResponse(args))
      })
  // random
  } else if(text == 'random') {
    troyism.count().then((count)=>{
      console.log(count)
      var index = Math.round(Math.random()*count)
      troyism.find({id: index}, (err, data)=>{
        data.toArray().then((d)=>{
          args.text = formatText(d)
          res.send(formatResponse(args))
        })
      })
    })
  // integer  
  } else if(Number.isInteger(parseInt(text))){
    var index = parseInt(text)
    troyism.find({id: index}, (err, data)=>{
      data.toArray().then((d)=>{
        args.text = formatText(d)
        res.send(formatResponse(args))
      })
    })
  //search
  } else if(text.split(' ')[0] == 'search'){
    var term = text.split(' ').slice(1).join(' ')
    troyism.find({$text: {$search: term}}, (err, data)=>{
      if(err) console.log(err)
      data.toArray().then((d)=>{
        args.text = formatText(d)
       res.send(formatResponse(args))
      })
    })
    //add
  } else if(text.split(' ')[0] == 'add'){
    var ism = text.split(' ').slice(1).join(' ')
    troyism.count().then((count)=>{
      troyism.save({id: count, ism: ism}, (err, data)=>{
        if(err){ args.text = "Something went wrong" }
        else {
          args.text = "Added: " + ism
        }
        res.send(formatResponse(args))
      })
    })
  //catch all  
  } else {
    res.send(formatResponse(args.text = "Something went wrong..."))
  }
}



/* HELPERS
~~~~~~~~~~~~~~~~~~~ */

function splitUpText(text){
  var split = text.split(' ')
}

// args = {channel, name, text, pretext, data, footer}
function formatResponse(args){
  var obj = {
            "fallback": "Couldn't find data! Sorry",
            "color": args.channel ? "#ff7832" : "#333333",
            "title": args.name || "Sorry!",
            "text": args.text || "Something went wrong",
  }
  if(args.pretext) obj.pretext = args.pretext
  // if(args.data){
  //   if(args.data.match(/\.(gif|jpg|jpeg|tiff|png)$/)){
  //     obj["image_url"] = args.data
  //   } else {
  //     obj.fields = [{
  //       title: "Data:",
  //       value: args.data
  //     }]
  //   }
  // }
  // if(args.footer) obj.footer = args.footer

  return {
          response_type: args.channel ? "in_channel" : "ephemeral",
          attachments:[obj]
        }
}

function formatText(array){
  var result = ''
  array.forEach((el)=>{
    result += `${el.id}.  ${el.ism}\n`
  })
  return result
}