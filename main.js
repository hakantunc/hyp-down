#!/usr/bin/env node

const _ = require('lodash');
const config = require('./config.json');
const fs = require('fs');
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
  .version('1.0.2')
  .description('Extract notes from Hypothes.is')
  .option('--days, -d <days>', 'Number of days to be fetched', prog.INT, 7)
  .action((args, options, logger) => {
    fetch(options.days);
  });

var fetch = function (days) {
  var date = new Date();
  var beg = new Date(date.getFullYear(), date.getMonth(), date.getDate() - days); // yes, this works
  var end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  request(options, function (error, response, body) {
    var data = JSON.parse(body);
    var notes
      = R.compose(
          R.mapObjIndexed((v, k, o) => R.sortWith([R.ascend(R.prop('date'))], v)),
          R.groupBy(o => o.source),
          R.map(o => ({
            date: new Date(o.updated),
            source: o.target[0].source,
            content: R.filter(R.complement(R.isNil), R.pluck('exact', o.target[0].selector))[0]
          })),
          R.filter(e => dateInBetween(new Date(e.updated), beg, end))
        )(data.rows);
    var file = fs.readFileSync(path.resolve(__dirname, 'output.template'));
    var output = _.template(file)({days: days, notes: notes});
    console.log(output);
  });
};

function dateInBetween (date, beg, end) {
  return date > beg && date < end;
}

prog.parse(process.argv);
