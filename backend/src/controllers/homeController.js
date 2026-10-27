'use strict';

async function index(req, res) {
  return res.render('home/index', {
    title: 'Panel Principal'
  });
}

module.exports = { index };
