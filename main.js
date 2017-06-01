#!/usr/bin/env node

const _ = require('lodash');
const config = require('./config.json');
const fs = require('fs');
const pjson = require('./package.json')
const path = require('path');
const prog = require('caporal');
const request = require('request');
const R = require('ramda');

var options = {
  url: 'https://hypothes.is/api/search',
  auth: {bearer: config.API_TOKEN},
  qs: {
    user: config.USER,
    limit: 120
  }
};

prog
  .version(pjson.version)
  .description('Extract notes from Hypothes.is')
  .option('--days, -d <days>', 'Number of days to be fetched', prog.INT, 7)
  .option('--imgur, -i', 'Add images from imgur', prog.BOOL, false)
  .option('--title, -t', 'Add title', prog.BOOL, false)
  .option('--debug', 'Debug', prog.BOOL, false)
  .action((args, options, logger) => {
    if (R.isNil(config.IMGUR_CLIENT_ID)) {
      return logger.info('Set your IMGUR_CLIENT_ID in config.json');
    }
    if (R.isNil(config.IMGUR_ACCESS_TOKEN)) {
      logger.info('Visit the link below and set the imgur tokens in the config file');
      return logger.info(`https://api.imgur.com/oauth2/authorize?client_id=${config.IMGUR_CLIENT_ID}&response_type=token`);
    }
    fetch(options.days, options.imgur, options.title, options.debug);
  });

var fetch = function (days, imgur, title, debug) {
  var date = new Date();
  var beg = new Date(date.getFullYear(), date.getMonth(), date.getDate() - days); // yes, this works
  var end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  request(options, function (error, response, body) {
    if (error) {
      return console.log(error);
    }
    var data = JSON.parse(body);
    var notes
      = R.compose(
          R.mapObjIndexed((v, k, o) => R.sortWith([R.ascend(R.prop('date'))], v)),
          R.groupBy(o => o.source),
          R.map(o => ({
            date: new Date(o.updated),
            title: o.document.title,
            source: o.target[0].source,
            content: R.filter(R.complement(R.isNil), R.pluck('exact', o.target[0].selector))[0],
            text: o.text
          })),
          R.reverse(),
          R.filter(e => dateInBetween(new Date(e.updated), beg, end))
        )(data.rows);
    var file = fs.readFileSync(path.resolve(__dirname, 'output.template'));
    var output = _.template(file)({days: days, title: title, notes: notes});
    console.log(output);
    if (imgur) {
      refreshImgurToken(function () {
        var imgurOptions = {
          url: 'https://api.imgur.com/3/account/me/images',
          auth: {bearer: config.IMGUR_ACCESS_TOKEN},
        };
        request(imgurOptions, function (error, response, body) {
          var data = JSON.parse(body);
          if (error) {
            return console.log('imgur', error);
          }
          if (data.status != 200) {
            console.log(`status:${data.status}`, data);
          }
          var images
            = R.compose(
                R.join('\n'),
                R.reverse(),
                R.map(o => `![](${o.link})`),
                R.filter(e => dateInBetween(new Date(e.datetime*1000), beg, end))
              )(data.data);
          console.log(images);
        });
      });
    }
    if (debug) {
      console.log(JSON.stringify(data.rows[0], null, '  '));
    }
  });
};

function refreshImgurToken (next) {
  var options = {
    url: 'https://api.imgur.com/oauth2/token',
    qs: {
      refresh_token: config.IMGUR_REFRESH_TOKEN,
      client_id: config.IMGUR_CLIENT_ID,
      client_secret: config.IMGUR_SECRET,
      grant_type: 'refresh_token'
    }
  };
  request.post(options.url, {form: options.qs}, function (error, response, body) {
    if (error) {
      console.log(error);
      return next(error);
    }
    var data = JSON.parse(body);
    config.IMGUR_ACCESS_TOKEN = data.access_token;
    config.IMGUR_REFRESH_TOKEN = data.refresh_token;
    fs.writeFileSync('./config.json', JSON.stringify(config, null, '  '));
    next();
  });
}

function dateInBetween (date, beg, end) {
  return date > beg && date < end;
}

prog.parse(process.argv);
