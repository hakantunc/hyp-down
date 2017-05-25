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
  .option('--title, -t', 'Add title', prog.BOOL, false)
  .option('--debug', 'Debug', prog.BOOL, false)
  .action((args, options, logger) => {
    fetch(options.days, options.title, options.debug);
  });

var fetch = function (days, title, debug) {
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
    if (debug) {
      console.log(JSON.stringify(data.rows[0], null, '  '));
    }
  });
};

function dateInBetween (date, beg, end) {
  return date > beg && date < end;
}

prog.parse(process.argv);
