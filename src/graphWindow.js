/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city graphs window (#graphWindow in index.html): how residents, shops, factories, crime, pollution and the
// cash flow have changed over the last 10 or 100 years (src/cityGraphs.ts). Opened from the Evaluation window.
// Clicking a series in the legend hides or shows it. Only reads the city.

import $ from "jquery";

import { drawChart, graphSeries, LIVING_MAX, MONEY_BALANCE, peopleMax, RANGE_YEARS } from './cityGraphs.ts';
import { onLanguageChange, t } from './i18n/index.ts';
import { GRAPH_WINDOW_CLOSED } from './messages.ts';
import { ModalWindow } from './modalWindow.js';

var GraphWindow = ModalWindow(function() {
  this._census = null;
  this._range = '10';
  this._hidden = new Set();

  $('#graphForm').on('submit', function(e) {
    e.preventDefault();
    this.close();
  }.bind(this));

  $('#graphWindow .graphRange button').on('click', function(e) {
    this._range = e.currentTarget.getAttribute('data-range');
    this._draw();
  }.bind(this));

  onLanguageChange(function() {
    if (this._census !== null)
      this._draw();
  }.bind(this));
});


GraphWindow.prototype._legend = function(elementId, series) {
  var self = this;
  var legend = document.getElementById(elementId);
  legend.replaceChildren.apply(legend, series.map(function(s) {
    var item = document.createElement('button');
    item.type = 'button';
    item.className = 'graphKey';
    item.style.setProperty('--key', s.colour);
    item.textContent = t('graphs.' + s.id);
    item.setAttribute('aria-pressed', String(!self._hidden.has(s.id)));
    item.addEventListener('click', function() {
      if (self._hidden.has(s.id))
        self._hidden.delete(s.id);
      else
        self._hidden.add(s.id);
      self._draw();
    });
    return item;
  }));
};


GraphWindow.prototype._draw = function() {
  var series = graphSeries(this._census, this._range);
  var visiblePeople = series.people.filter(function(s) { return !this._hidden.has(s.id); }, this);
  drawChart(document.getElementById('graphPeople'), series.people, this._hidden, peopleMax(visiblePeople));
  drawChart(document.getElementById('graphLiving'), series.living, this._hidden, LIVING_MAX, MONEY_BALANCE);
  this._legend('graphPeopleLegend', series.people);
  this._legend('graphLivingLegend', series.living);

  var years = RANGE_YEARS[this._range];
  $('#graphWindow .graphFrom').text(t('graphs.ago', {years: years}));
  $('#graphWindow .graphRange button').each(function(i, button) {
    button.setAttribute('aria-pressed', String(button.getAttribute('data-range') === this._range));
  }.bind(this));
};


GraphWindow.prototype.open = function(census) {
  this._census = census;
  this._toggleDisplay();
  this._draw();
  $('#graphOK').focus();
};


GraphWindow.prototype.close = function() {
  this._emitEvent(GRAPH_WINDOW_CLOSED);
  this._toggleDisplay();
};


export { GraphWindow };
